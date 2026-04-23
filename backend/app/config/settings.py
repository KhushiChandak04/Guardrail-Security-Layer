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


def resolve_optional_runtime_path(path_value: str) -> str:
    if not path_value or not path_value.strip():
        return ""
    return resolve_runtime_path(path_value)


def model_path_has_artifacts(path_value: str) -> bool:
    if not path_value:
        return False

    model_path = Path(path_value)
    if not model_path.exists() or not model_path.is_dir():
        return False

    marker_files = {
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "modules.json",
        "sentence_bert_config.json",
    }
    return any((model_path / marker).exists() for marker in marker_files)


def resolve_model_reference(*, model_name: str, model_path: str, local_only: bool, model_label: str) -> str:
    resolved_path = resolve_optional_runtime_path(model_path)
    if model_path_has_artifacts(resolved_path):
        return resolved_path

    if local_only:
        raise ValueError(
            f"{model_label} local artifacts not found at '{resolved_path}'. "
            "Disable MODELS_LOCAL_ONLY or provide a valid local model path."
        )

    normalized_name = str(model_name or "").strip()
    if not normalized_name:
        raise ValueError(
            f"{model_label} model name is empty and no local artifacts were found at '{resolved_path}'."
        )
    return normalized_name


class Settings(BaseSettings):
    app_name: str = "Guardrail AI Middleware"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"
    llm_temperature: float = 0.2
    models_local_only: bool = False

    embedding_model_name: str = "all-MiniLM-L6-v2"
    embedding_model_path: str = "./models/all-MiniLM-L6-v2"
    prompt_injection_model_name: str = "protectai/deberta-v3-base-prompt-injection"
    prompt_injection_model_path: str = "./models/deberta-v3-base-prompt-injection"
    secondary_prompt_injection_model_name: str = "protectai/deberta-v3-base-prompt-injection"
    secondary_prompt_injection_model_path: str = "./models/deberta-v3-base-prompt-injection"
    toxicity_model_name: str = "unitary/toxic-bert"
    toxicity_model_path: str = "./models/toxic-bert"

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

    @property
    def resolved_embedding_model_path(self) -> str:
        return resolve_optional_runtime_path(self.embedding_model_path)

    @property
    def resolved_prompt_injection_model_path(self) -> str:
        return resolve_optional_runtime_path(self.prompt_injection_model_path)

    @property
    def resolved_secondary_prompt_injection_model_path(self) -> str:
        return resolve_optional_runtime_path(self.secondary_prompt_injection_model_path)

    @property
    def resolved_toxicity_model_path(self) -> str:
        return resolve_optional_runtime_path(self.toxicity_model_path)

    @property
    def embedding_model_ref(self) -> str:
        return resolve_model_reference(
            model_name=self.embedding_model_name,
            model_path=self.embedding_model_path,
            local_only=self.models_local_only,
            model_label="Embedding model",
        )

    @property
    def prompt_injection_model_ref(self) -> str:
        return resolve_model_reference(
            model_name=self.prompt_injection_model_name,
            model_path=self.prompt_injection_model_path,
            local_only=self.models_local_only,
            model_label="Primary prompt-injection model",
        )

    @property
    def secondary_prompt_injection_model_ref(self) -> str:
        return resolve_model_reference(
            model_name=self.secondary_prompt_injection_model_name,
            model_path=self.secondary_prompt_injection_model_path,
            local_only=self.models_local_only,
            model_label="Secondary prompt-injection model",
        )

    @property
    def toxicity_model_ref(self) -> str:
        return resolve_model_reference(
            model_name=self.toxicity_model_name,
            model_path=self.toxicity_model_path,
            local_only=self.models_local_only,
            model_label="Toxicity model",
        )

    @property
    def using_local_embedding_model(self) -> bool:
        return self.embedding_model_ref == self.resolved_embedding_model_path and bool(self.resolved_embedding_model_path)

    @property
    def using_local_prompt_injection_model(self) -> bool:
        return self.prompt_injection_model_ref == self.resolved_prompt_injection_model_path and bool(self.resolved_prompt_injection_model_path)

    @property
    def using_local_secondary_prompt_injection_model(self) -> bool:
        return (
            self.secondary_prompt_injection_model_ref == self.resolved_secondary_prompt_injection_model_path
            and bool(self.resolved_secondary_prompt_injection_model_path)
        )

    @property
    def using_local_toxicity_model(self) -> bool:
        return self.toxicity_model_ref == self.resolved_toxicity_model_path and bool(self.resolved_toxicity_model_path)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
