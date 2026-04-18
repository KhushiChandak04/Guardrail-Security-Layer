from functools import lru_cache

from app.config.settings import settings
from app.core.guardrail_engine import GuardrailEngine
from app.services.auth_service import AuthService
from app.services.firebase_service import FirebaseService
from app.services.llm_service import LLMService
from app.services.vector_service import VectorService


@lru_cache
def get_vector_service() -> VectorService:
    return VectorService(
        persist_path=settings.chroma_path,
        collection_name=settings.chroma_collection,
        seed_file=settings.jailbreak_seed_file,
    )


@lru_cache
def get_llm_service() -> LLMService:
    return LLMService(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=settings.llm_temperature,
    )


@lru_cache
def get_firebase_service() -> FirebaseService:
    return FirebaseService(
        project_id=settings.firebase_project_id,
        credentials_path=settings.firebase_credentials_path,
        collection_name=settings.firestore_collection,
    )


@lru_cache
def get_auth_service() -> AuthService:
    return AuthService()


@lru_cache
def get_guardrail_engine() -> GuardrailEngine:
    return GuardrailEngine(vector_service=get_vector_service())
