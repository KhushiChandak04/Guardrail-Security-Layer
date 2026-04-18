from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root_status() -> dict[str, object]:
    return {
        "service": "guardrail-security-layer-backend",
        "status": "ok",
        "routes": {
            "health": "/health",
            "chat": "/api/chat",
            "scan_document": "/scan-document",
            "guardrail_diagnostics": "/api/diagnostics/guardrails",
            "logs": "/api/logs",
            "stats": "/api/stats",
            "policies": "/api/policies",
            "docs": "/docs",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
