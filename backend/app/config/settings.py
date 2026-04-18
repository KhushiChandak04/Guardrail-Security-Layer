from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
WORKSPACE_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"


def resolve_runtime_path(path_value: str) -> str:
    candidate = Path(path_value)
    if candidate.is_absolute():
        return str(candidate.resolve())

    normalized = str(candidate).replace("\\", "/")
    if normalized.startswith("backend/"):
        return str((WORKSPACE_DIR / normalized).resolve())

    return str((BACKEND_DIR / candidate).resolve())


class Settings(BaseSettings):
    app_name: str = "Guardrail AI Middleware"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    llm_temperature: float = 0.2

    chroma_path: str = "./.chroma"
    chroma_collection: str = "jailbreak_patterns"
    jailbreak_similarity_threshold: float = 0.79
    jailbreak_seed_file: str = "./app/data/jailbreak_seed.txt"
    ingress_block_threshold: int = 70
    ingress_sanitize_threshold: int = 40

    firebase_project_id: str = ""
    firebase_credentials_path: str = ""
    firestore_interactions_collection: str = "interactions"
    firestore_sessions_collection: str = "sessions"
    firestore_users_collection: str = "users"
    firestore_policies_collection: str = "policies"
    firestore_threat_patterns_collection: str = "threat_patterns"
    firestore_analytics_cache_collection: str = "analytics_cache"

    # model_config = SettingsConfigDict(
    #     env_file=("backend/.env",),
    #     env_file_encoding="utf-8",
    #     case_sensitive=False,
    #     extra="ignore",
    # )
    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE),),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("llm_temperature")
    @classmethod
    def validate_temperature(cls, value: float) -> float:
        return max(0.0, min(1.0, value))

    @field_validator("ingress_block_threshold", "ingress_sanitize_threshold")
    @classmethod
    def validate_thresholds(cls, value: int) -> int:
        return max(0, min(100, value))

    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]
        return origins or ["*"]

    @property
    def resolved_chroma_path(self) -> str:
        return resolve_runtime_path(self.chroma_path)

    @property
    def resolved_jailbreak_seed_file(self) -> str:
        return resolve_runtime_path(self.jailbreak_seed_file)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
