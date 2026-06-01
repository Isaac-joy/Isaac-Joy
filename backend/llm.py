"""Async LLM clients — free tiers only.

The Council  -> Gemini 2.5 Flash (one combined call, JSON mode).
The System    -> DeepSeek R1 via OpenRouter (:free), reasoning stripped + validated.

Both validate against Pydantic and retry with a stricter instruction on malformed
JSON, so the mobile UI never receives a broken payload.
"""
import re

import httpx

from config import settings
from models import CouncilAudit, SystemVerdict
from prompts import SYNTHESIZER_SYSTEM, build_council_prompt, build_synthesizer_prompt

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{settings.gemini_model}:generateContent"
)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def _extract_json(text: str) -> str:
    """Strip R1 <think> blocks and markdown fences, isolate the JSON object."""
    if not text or not text.strip():
        raise ValueError("empty LLM response")
    cleaned = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned).strip()
    if not cleaned.startswith("{"):
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            cleaned = cleaned[start : end + 1]
    return cleaned


async def run_council(user: dict, log_data: str) -> CouncilAudit:
    prompt = build_council_prompt(user, log_data)
    params = {"key": settings.gemini_api_key}
    last_err = None
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        for _ in range(settings.json_retries):
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.7,
                },
            }
            resp = await client.post(GEMINI_URL, params=params, json=payload)
            resp.raise_for_status()
            data = resp.json()
            try:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return CouncilAudit.model_validate_json(_extract_json(text))
            except Exception as e:  # noqa: BLE001
                last_err = e
                prompt += "\n\nReturn ONLY valid JSON matching the schema. No prose."
    raise ValueError(f"Council returned invalid JSON after retries: {last_err}")


async def run_synthesizer(user: dict, audits: CouncilAudit) -> SystemVerdict:
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.openrouter_referer,
        "X-Title": settings.openrouter_title,
    }
    messages = [
        {"role": "system", "content": SYNTHESIZER_SYSTEM},
        {"role": "user", "content": build_synthesizer_prompt(user, audits.model_dump())},
    ]
    last_err = None
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        for _ in range(settings.json_retries):
            payload = {
                "model": settings.openrouter_model,
                "messages": messages,
                "temperature": 0.4,
            }
            resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = ""
            try:
                content = data["choices"][0]["message"]["content"]
                return SystemVerdict.model_validate_json(_extract_json(content))
            except Exception as e:  # noqa: BLE001
                last_err = e
                messages.append({"role": "assistant", "content": content})
                messages.append({
                    "role": "user",
                    "content": (
                        "That was not valid JSON for the required schema. "
                        "Return ONLY the raw JSON object — no markdown, no commentary."
                    ),
                })
    raise ValueError(f"Synthesizer returned invalid JSON after retries: {last_err}")
