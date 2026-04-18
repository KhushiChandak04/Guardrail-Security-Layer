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
        persist_path=settings.resolved_chroma_path,
        collection_name=settings.chroma_collection,
        seed_file=settings.resolved_jailbreak_seed_file,
        embedding_model=settings.embedding_model_ref,
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
        jailbreak_seed_file=settings.resolved_jailbreak_seed_file,
        ingress_block_threshold=settings.ingress_block_threshold,
        ingress_sanitize_threshold=settings.ingress_sanitize_threshold,
        jailbreak_similarity_threshold=settings.jailbreak_similarity_threshold,
        interactions_collection=settings.firestore_interactions_collection,
        sessions_collection=settings.firestore_sessions_collection,
        users_collection=settings.firestore_users_collection,
        policies_collection=settings.firestore_policies_collection,
        threat_patterns_collection=settings.firestore_threat_patterns_collection,
        analytics_cache_collection=settings.firestore_analytics_cache_collection,
    )


@lru_cache
def get_auth_service() -> AuthService:
    return AuthService()


@lru_cache
def get_guardrail_engine() -> GuardrailEngine:
    return GuardrailEngine(vector_service=get_vector_service())
