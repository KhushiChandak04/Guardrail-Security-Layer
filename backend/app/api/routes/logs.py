from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.api.dependencies import get_auth_service, get_firebase_service
from app.services.auth_service import AuthService
from app.services.firebase_service import FirebaseService

router = APIRouter()

INVALID_UID_VALUES = {"", "anonymous", "unknown", "token-not-verified", "invalid-token"}


def _extract_bearer_token(authorization: str | None) -> str:
    raw_value = str(authorization or "").strip()
    if not raw_value:
        return ""

    if raw_value.lower().startswith("bearer "):
        return raw_value[7:].strip()

    return raw_value


def _is_valid_uid(value: str | None) -> bool:
    uid = str(value or "").strip()
    return bool(uid) and uid not in INVALID_UID_VALUES


async def _resolve_request_uid(
    *,
    auth_service: AuthService,
    authorization: str | None,
    header_user_id: str | None,
) -> str:
    bearer_token = _extract_bearer_token(authorization)
    fallback_uid = str(header_user_id or "").strip()

    if bearer_token:
        principal = await auth_service.verify_id_token(bearer_token)
        verified_uid = str(principal.get("uid", "")).strip()

        if not _is_valid_uid(verified_uid):
            raise HTTPException(status_code=401, detail="Invalid authentication token.")

        if fallback_uid and fallback_uid != verified_uid:
            raise HTTPException(status_code=401, detail="Authenticated user mismatch.")

        return verified_uid

    if _is_valid_uid(fallback_uid):
        return fallback_uid

    raise HTTPException(status_code=401, detail="Authentication required.")


def _risk_score(item: dict) -> int:
    input_score = item.get("input_risk_score")
    output_score = item.get("output_risk_score")

    input_value = int(input_score) if isinstance(input_score, (int, float)) else 0
    output_value = int(output_score) if isinstance(output_score, (int, float)) else 0
    return max(input_value, output_value)


def _matches_decision(item: dict, decision: str | None) -> bool:
    if not decision:
        return True

    normalized = decision.strip().lower()
    decision_value = str(item.get("decision", "")).lower()
    if normalized in {"all", ""}:
        return True
    if normalized in {"blocked", "block"}:
        return decision_value == "blocked"
    if normalized in {"redacted", "modified", "redact"}:
        return decision_value == "modified" or bool(item.get("redacted", False))
    if normalized in {"passed", "allow", "allowed"}:
        return decision_value == "allowed"

    return decision_value == normalized


def _matches_level(item: dict, level: str | None) -> bool:
    if not level:
        return True

    normalized = level.strip().lower()
    if normalized in {"all", ""}:
        return True

    score = _risk_score(item)
    if normalized == "critical":
        return score > 85
    if normalized == "high":
        return 60 < score <= 85
    if normalized == "medium":
        return 30 < score <= 60
    if normalized == "low":
        return score <= 30

    return True


def _matches_search(item: dict, search: str | None) -> bool:
    if not search:
        return True

    query = search.strip().lower()
    if not query:
        return True

    candidates = [
        str(item.get("input_text", "")),
        str(item.get("output_text", "")),
        str(item.get("reason", "")),
        str(item.get("user_id", "")),
        str(item.get("session_id", "")),
    ]
    return any(query in candidate.lower() for candidate in candidates)


@router.get("/logs")
async def list_recent_logs(
    firebase_service: FirebaseService = Depends(get_firebase_service),
    auth_service: AuthService = Depends(get_auth_service),
    limit: int = Query(default=25, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    decision: str | None = Query(default=None),
    level: str | None = Query(default=None),
    search: str | None = Query(default=None),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_guardrail_user_id: str | None = Header(default=None, alias="X-Guardrail-User-Id"),
) -> dict:
    user_id = await _resolve_request_uid(
        auth_service=auth_service,
        authorization=authorization,
        header_user_id=x_guardrail_user_id,
    )

    needs_filter = bool(decision or level or search)
    fetch_limit = 250 if needs_filter else min(max(limit + offset, 1), 200)
    logs = await firebase_service.fetch_recent(limit=fetch_limit, user_id=user_id)

    filtered = [
        item
        for item in logs
        if _matches_decision(item, decision)
        and _matches_level(item, level)
        and _matches_search(item, search)
    ]

    page_items = filtered[offset: offset + limit]

    return {
        "count": len(page_items),
        "total_filtered": len(filtered),
        "items": page_items,
        "source": "firestore" if firebase_service.enabled else "local",
    }


@router.get("/stats")
async def get_live_stats(
    firebase_service: FirebaseService = Depends(get_firebase_service),
    auth_service: AuthService = Depends(get_auth_service),
    limit: int = Query(default=250, ge=25, le=500),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_guardrail_user_id: str | None = Header(default=None, alias="X-Guardrail-User-Id"),
) -> dict:
    user_id = await _resolve_request_uid(
        auth_service=auth_service,
        authorization=authorization,
        header_user_id=x_guardrail_user_id,
    )
    return await firebase_service.fetch_stats(limit=limit, user_id=user_id)
