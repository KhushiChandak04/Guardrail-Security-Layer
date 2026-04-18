from fastapi import APIRouter, Depends

from app.api.dependencies import get_firebase_service
from app.services.firebase_service import FirebaseService

router = APIRouter()


@router.get("/logs")
async def list_recent_logs(firebase_service: FirebaseService = Depends(get_firebase_service)) -> dict:
    logs = await firebase_service.fetch_recent(limit=25)
    return {
        "count": len(logs),
        "items": logs,
        "source": "firestore" if firebase_service.enabled else "local",
    }
