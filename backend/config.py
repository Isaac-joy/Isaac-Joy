"""Typed settings loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Gemini (free tier) — the Council (primary)
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    # OpenRouter (free) — Synthesizer pool + Council fallbacks
    openrouter_api_key: str
    openrouter_model: str = "openai/gpt-oss-120b:free"  # legacy single (kept for ref)
    openrouter_referer: str = "https://solo-leveling-council.app"
    openrouter_title: str = "Solo Leveling Council"
    # Synthesizer model pool — tried in order; auto-failover on busy/error/bad-JSON.
    # Gemma 4 (Google's latest open model) leads: 31B for quality, 26B-MoE for speed,
    # then the proven free models, then Gemini as the cross-provider last resort.
    openrouter_models: str = (
        "google/gemma-4-31b-it:free,"
        "google/gemma-4-26b-a4b-it:free,"
        "openai/gpt-oss-120b:free,"
        "meta-llama/llama-3.3-70b-instruct:free,"
        "qwen/qwen3-next-80b-a3b-instruct:free,"
        "z-ai/glm-4.5-air:free"
    )
    # Council = Gemini first; these free OpenRouter models are the fallbacks.
    council_fallback_models: str = (
        "google/gemma-4-31b-it:free,"
        "openai/gpt-oss-120b:free,"
        "meta-llama/llama-3.3-70b-instruct:free"
    )

    # Tuning
    max_attempts: int = 3
    json_retries: int = 3
    worker_poll_seconds: float = 5.0
    llm_timeout_seconds: float = 120.0
    max_submissions_per_user_per_day: int = 3
    worker_concurrency: int = 3  # logs processed in parallel
    cors_origins: str = "*"

    @property
    def synth_model_list(self) -> list[str]:
        return [m.strip() for m in self.openrouter_models.split(",") if m.strip()]

    @property
    def council_fallback_list(self) -> list[str]:
        return [m.strip() for m in self.council_fallback_models.split(",") if m.strip()]


settings = Settings()
