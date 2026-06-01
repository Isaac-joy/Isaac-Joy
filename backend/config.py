"""Typed settings loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Gemini (free tier) — the Council
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    # DeepSeek R1 via OpenRouter (free) — the Synthesizer
    openrouter_api_key: str
    openrouter_model: str = "openai/gpt-oss-120b:free"
    openrouter_referer: str = "https://solo-leveling-council.app"
    openrouter_title: str = "Solo Leveling Council"

    # Tuning
    max_attempts: int = 3
    json_retries: int = 3
    worker_poll_seconds: float = 5.0
    llm_timeout_seconds: float = 120.0
    max_submissions_per_user_per_day: int = 3
    cors_origins: str = "*"


settings = Settings()
