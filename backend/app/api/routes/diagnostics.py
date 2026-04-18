from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.dependencies import get_firebase_service, get_guardrail_engine, get_vector_service
from app.config.settings import settings
from app.core.guardrail_engine import GuardrailEngine
from app.services.firebase_service import FirebaseService
from app.services.vector_service import VectorService

router = APIRouter()


@router.get("/diagnostics/guardrails")
async def guardrail_diagnostics(
    firebase_service: FirebaseService = Depends(get_firebase_service),
    guardrail_engine: GuardrailEngine = Depends(get_guardrail_engine),
    vector_service: VectorService = Depends(get_vector_service),
) -> dict[str, object]:
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
        },
        "storage": storage_snapshot,
    }
