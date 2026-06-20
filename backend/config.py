"""Application configuration — type-safe, validated, loaded from environment."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    All values are validated on startup. Missing required fields cause
    an immediate, descriptive error — failing fast per our coding standards.
    """

    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "DataWeaver (DW)"
    DEBUG: bool = False
    API_VERSION: str = "v1"

    # ── Database ────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/app.db"

    # ── Storage ─────────────────────────────────────────────────────────
    PARQUET_STORAGE_PATH: str = "./data/parquets"
    MAX_UPLOAD_SIZE_MB: int = 2048
    CHUNK_SIZE_BYTES: int = 5_242_880  # 5 MB

    # ── Auth ────────────────────────────────────────────────────────────
    JWT_SECRET: str = "change-me-to-a-random-secret-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24
    OAUTH_GOOGLE_CLIENT_ID: str = ""
    OAUTH_GOOGLE_CLIENT_SECRET: str = ""
    OAUTH_GITHUB_CLIENT_ID: str = ""
    OAUTH_GITHUB_CLIENT_SECRET: str = ""

    # ── Encryption ──────────────────────────────────────────────────────
    ENCRYPTION_KEY: str = "change-me-to-a-32-byte-key-in-production"

    # ── CORS ────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # ── LLM ─────────────────────────────────────────────────────────────
    DEFAULT_LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    # Point at an OpenAI-compatible endpoint for non-OpenAI providers:
    #   Gemini:     https://generativelanguage.googleapis.com/v1beta/openai/
    #   Groq:       https://api.groq.com/openai/v1
    #   OpenRouter: https://openrouter.ai/api/v1
    #   Ollama:     http://localhost:11434/v1
    # Leave blank to use the official OpenAI endpoint.
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = "gpt-4o"

    # ── Google OAuth ────────────────────────────────────────────────────
    # Redirect path appended to BACKEND_URL — must match Google Console config
    GOOGLE_OAUTH_REDIRECT_PATH: str = "/api/v1/auth/google/callback"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance (singleton)."""
    return Settings()
