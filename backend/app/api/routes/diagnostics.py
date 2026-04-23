from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_firebase_service, get_guardrail_engine, get_vector_service
from app.config.settings import settings
from app.core.guardrail_engine import GuardrailEngine
from app.models.diagnostics_models import GuardrailDiagnosticsResponse
from app.services.firebase_service import FirebaseService
from app.services.vector_service import VectorService

router = APIRouter()


@router.get("/diagnostics/guardrails", response_model=GuardrailDiagnosticsResponse)
async def guardrail_diagnostics(
    firebase_service: FirebaseService = Depends(get_firebase_service),
    guardrail_engine: GuardrailEngine = Depends(get_guardrail_engine),
    vector_service: VectorService = Depends(get_vector_service),
) -> GuardrailDiagnosticsResponse:
    storage_snapshot = await firebase_service.fetch_guardrail_snapshot()

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "runtime_policy": {
            "ingress_block_threshold": guardrail_engine.risk_block_threshold,
            "ingress_sanitize_threshold": guardrail_engine.risk_sanitize_threshold,
            "jailbreak_similarity_threshold": settings.jailbreak_similarity_threshold,
        },
        "vector_intelligence": {
            "collection": settings.chroma_collection,
            "seed_file": settings.resolved_jailbreak_seed_file,
            "seed_pattern_count": len(vector_service.list_seed_patterns()),
            "embedding_model": settings.embedding_model_ref,
            "embedding_model_name": settings.embedding_model_name,
            "embedding_model_path": settings.resolved_embedding_model_path,
            "embedding_model_local": settings.using_local_embedding_model,
        },
        "ml_models": {
            "local_only": settings.models_local_only,
            "ingress_concurrent_checks": 4,
            "llm": {
                "provider": "groq",
                "model": settings.groq_model,
                "temperature": settings.llm_temperature,
            },
            "prompt_injection_model": settings.prompt_injection_model_ref,
            "prompt_injection_model_name": settings.prompt_injection_model_name,
            "prompt_injection_model_path": settings.resolved_prompt_injection_model_path,
            "prompt_injection_model_local": settings.using_local_prompt_injection_model,
            "secondary_prompt_injection_model": settings.secondary_prompt_injection_model_ref,
            "secondary_prompt_injection_model_name": settings.secondary_prompt_injection_model_name,
            "secondary_prompt_injection_model_path": settings.resolved_secondary_prompt_injection_model_path,
            "secondary_prompt_injection_model_local": settings.using_local_secondary_prompt_injection_model,
            "toxicity_model": settings.toxicity_model_ref,
            "toxicity_model_name": settings.toxicity_model_name,
            "toxicity_model_path": settings.resolved_toxicity_model_path,
            "toxicity_model_local": settings.using_local_toxicity_model,
        },
        "storage": storage_snapshot,
    }
