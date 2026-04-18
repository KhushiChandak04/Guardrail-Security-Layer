from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_auth_service, get_firebase_service
from app.services.auth_service import AuthService
from app.services.firebase_service import FirebaseService

router = APIRouter()


class SyncUserRequest(BaseModel):
    id_token: str = Field(min_length=1)
    display_name: str | None = None


class SyncUserResponse(BaseModel):
    synced: bool
    user_id: str
    source: str


@router.post("/auth/sync-user", response_model=SyncUserResponse)
async def sync_authenticated_user(
    payload: SyncUserRequest,
    auth_service: AuthService = Depends(get_auth_service),
    firebase_service: FirebaseService = Depends(get_firebase_service),
) -> SyncUserResponse:
    if not firebase_service.enabled:
        raise HTTPException(status_code=503, detail="Firebase service is not configured on backend")

    user = await auth_service.verify_id_token(payload.id_token)
    user_id = user.get("uid", "")

    if user_id in {"", "anonymous", "token-not-verified", "invalid-token", "unknown"}:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

    user_email = user.get("email", "")
    display_name = payload.display_name or user.get("name", "")

    synced = await firebase_service.sync_user_profile(
        user_id=user_id,
        user_email=user_email,
        display_name=display_name,
    )

    if not synced:
        raise HTTPException(status_code=500, detail="Unable to sync user profile to Firestore")

    return SyncUserResponse(
        synced=True,
        user_id=user_id,
        source="firestore",
    )