"""Async LLM clients with multi-provider failover — free tiers only.

Every AI task (council, synthesizer, missions, workouts, resources, polish) rides the
same architecture: an ordered pool of free OpenRouter models led by Gemma 4 31B
(blind-judged best for this app's tasks), auto-shifting on 429 / 5xx / timeout /
bad-JSON, with Gemini 2.5 Flash as the cross-provider last resort (separate quota).

A single provider being rate-limited or slow never blocks a request — it moves down the pool.
"""
import re

import httpx

from config import settings
from errors import AIUnavailableError
from models import (
    CouncilAudit,
    MissionList,
    MissionPolish,
    ResourceList,
    SystemVerdict,
    WorkoutPlan,
)
from prompts import (
    MISSIONS_SYSTEM,
    POLISH_SYSTEM,
    RESOURCES_SYSTEM,
    SYNTHESIZER_SYSTEM,
    WORKOUT_SYSTEM,
    build_council_prompt,
    build_missions_prompt,
    build_polish_prompt,
    build_resources_prompt,
    build_synthesizer_prompt,
    build_workout_prompt,
)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{settings.gemini_model}:generateContent"
)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

COUNCIL_SYSTEM = (
    "You are the three-member Council of a Solo-Leveling self-improvement app. "
    "You output ONLY raw JSON — no markdown, no commentary."
)


def _extract_json(text: str) -> str:
    """Strip reasoning <think> blocks and markdown fences, isolate the JSON object."""
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


async def _gemini_json(client: httpx.AsyncClient, prompt: str) -> str:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.7},
    }
    resp = await client.post(
        GEMINI_URL, params={"key": settings.gemini_api_key}, json=payload
    )
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


async def _openrouter_chat(
    client: httpx.AsyncClient, model: str, messages: list, temperature: float = 0.4
) -> str:
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "HTTP-Referer": settings.openrouter_referer,
        "X-Title": settings.openrouter_title,
    }
    payload = {"model": model, "messages": messages, "temperature": temperature}
    resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _openrouter_json(
    client, models, system_msg, user_msg, validate, temperature=0.4, gemini_fallback=True
):
    """Try each free model in the pool; on exhaustion, fall back to Gemini.

    Failover on HTTP errors (429 / 5xx / timeout), retry on bad JSON. Every failure
    is logged so the server logs reveal the real reason (auth vs rate-limit vs bad JSON).
    Gemini has a separate quota, so it covers the case where the whole free pool is busy.
    """
    errors: list[str] = []
    for model in models:
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ]
        for _ in range(settings.json_retries):
            try:
                content = await _openrouter_chat(client, model, messages, temperature)
            except httpx.HTTPError as e:  # busy / rate-limited / 5xx / timeout → next model
                print(f"[llm] openrouter {model} http error: {e!r}", flush=True)
                errors.append(f"{model} http")
                break
            try:
                return validate(_extract_json(content))
            except Exception as e:  # noqa: BLE001 — bad JSON → retry same model with a nudge
                print(f"[llm] openrouter {model} bad json: {e!r}", flush=True)
                errors.append(f"{model} json")
                messages.append({"role": "assistant", "content": content})
                messages.append({
                    "role": "user",
                    "content": "Return ONLY the raw JSON object matching the schema.",
                })

    # Cross-provider last resort: Gemini (separate quota from the free OpenRouter pool).
    if gemini_fallback:
        try:
            text = await _gemini_json(client, f"{system_msg}\n\n{user_msg}")
            return validate(_extract_json(text))
        except Exception as e:  # noqa: BLE001
            print(f"[llm] gemini fallback failed: {e!r}", flush=True)
            errors.append("gemini")

    print(f"[llm] ALL providers failed: {errors}", flush=True)
    raise AIUnavailableError()


async def run_council(user: dict, log_data: str) -> CouncilAudit:
    """Council pool: Gemma 4 31B first (won the blind persona/actionability judging),
    then the proven free models, then Gemini as the cross-provider last resort."""
    prompt = build_council_prompt(user, log_data)
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        try:
            return await _openrouter_json(
                client, settings.council_fallback_list, COUNCIL_SYSTEM, prompt,
                CouncilAudit.model_validate_json, temperature=0.7, gemini_fallback=True,
            )
        except AIUnavailableError:
            raise AIUnavailableError(
                "The Council could not convene — every AI model is busy or rate-limited. "
                "Your report is saved; it will be evaluated automatically on retry."
            )


async def run_synthesizer(user: dict, audits: CouncilAudit) -> SystemVerdict:
    user_msg = build_synthesizer_prompt(user, audits.model_dump())
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        return await _openrouter_json(
            client, settings.synth_model_list, SYNTHESIZER_SYSTEM, user_msg,
            SystemVerdict.model_validate_json,
        )


async def generate_missions(user: dict) -> list:
    user_msg = build_missions_prompt(user)
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        result = await _openrouter_json(
            client, settings.synth_model_list, MISSIONS_SYSTEM, user_msg,
            MissionList.model_validate_json, temperature=0.6,
        )
    return result.missions


async def polish_mission(user: dict, title: str, description: str) -> MissionPolish:
    user_msg = build_polish_prompt(user, title, description)
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        return await _openrouter_json(
            client, settings.synth_model_list, POLISH_SYSTEM, user_msg,
            MissionPolish.model_validate_json,
        )


async def generate_workout(user: dict) -> WorkoutPlan:
    user_msg = build_workout_prompt(user)
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        return await _openrouter_json(
            client, settings.synth_model_list, WORKOUT_SYSTEM, user_msg,
            WorkoutPlan.model_validate_json, temperature=0.6,
        )


async def generate_resources(user: dict) -> list:
    user_msg = build_resources_prompt(user)
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        result = await _openrouter_json(
            client, settings.synth_model_list, RESOURCES_SYSTEM, user_msg,
            ResourceList.model_validate_json, temperature=0.5,
        )
    return result.resources
