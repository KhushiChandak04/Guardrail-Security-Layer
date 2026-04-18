from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_firebase_service, get_guardrail_engine
from app.core.guardrail_engine import GuardrailEngine
from app.services.firebase_service import FirebaseService

router = APIRouter()


class PolicyUpdateRequest(BaseModel):
    max_risk_score: int = Field(ge=0, le=100)
    sanitize_risk_score: int = Field(ge=0, le=100)
    redact_pii: bool = True
    block_categories: list[str] = Field(default_factory=list)
    blocked_topics: list[str] = Field(default_factory=list)
    pii_detection: dict[str, bool] = Field(default_factory=dict)
    honeypot_mode: bool = False
    multi_turn_tracking: bool = True


@router.get("/policies")
async def get_policy_config(
    firebase_service: FirebaseService = Depends(get_firebase_service),
) -> dict[str, object]:
    return await firebase_service.fetch_policy_config()


@router.put("/policies")
async def update_policy_config(
    payload: PolicyUpdateRequest,
    firebase_service: FirebaseService = Depends(get_firebase_service),
    guardrail_engine: GuardrailEngine = Depends(get_guardrail_engine),
) -> dict[str, object]:
    if payload.sanitize_risk_score > payload.max_risk_score:
        raise HTTPException(status_code=400, detail="sanitize_risk_score cannot exceed max_risk_score")

    updated = await firebase_service.update_policy_config(
        max_risk_score=payload.max_risk_score,
        sanitize_risk_score=payload.sanitize_risk_score,
        redact_pii=payload.redact_pii,
        block_categories=payload.block_categories,
        blocked_topics=payload.blocked_topics,
        pii_detection=payload.pii_detection,
        honeypot_mode=payload.honeypot_mode,
        multi_turn_tracking=payload.multi_turn_tracking,
    )

    # Apply thresholds immediately for current process runtime.
    guardrail_engine.risk_block_threshold = payload.max_risk_score
    guardrail_engine.risk_sanitize_threshold = payload.sanitize_risk_score

    return updated
