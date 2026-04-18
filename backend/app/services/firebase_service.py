import asyncio
import logging

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)


class FirebaseService:
    def __init__(self, *, project_id: str, credentials_path: str, collection_name: str) -> None:
        self.collection_name = collection_name
        self.enabled = False

        if not credentials_path:
            logger.info("Firebase credentials are not configured. Using local logging mode.")
            self.enabled = False
            return

        try:
            if not firebase_admin._apps:
                options = {"projectId": project_id} if project_id else None
                cred = credentials.Certificate(credentials_path)
                firebase_admin.initialize_app(cred, options=options)
            self.enabled = True
        except Exception as error:
            logger.warning("Firebase not configured. Logging will stay local. Details: %s", error)
            self.enabled = False

    async def log_incident(
        self,
        *,
        user_id: str,
        prompt_preview: str,
        response_preview: str,
        blocked: bool,
        ingress_risk: str,
        output_risk: str,
        redactions: list[str],
        model: str,
        reason: str,
        session_id: str | None,
        metadata: dict[str, str],
        request_id: str,
    ) -> None:
        if not self.enabled:
            return

        payload = {
            "user_id": user_id,
            "prompt_preview": prompt_preview,
            "response_preview": response_preview,
            "blocked": blocked,
            "ingress_risk": ingress_risk,
            "output_risk": output_risk,
            "redactions": redactions,
            "model": model,
            "reason": reason,
            "session_id": session_id,
            "metadata": metadata,
            "request_id": request_id,
        }

        def _write() -> None:
            firestore.client().collection(self.collection_name).add(payload)

        try:
            await asyncio.to_thread(_write)
        except Exception as error:
            logger.warning("Firestore write failed. Falling back to local mode. Details: %s", error)
            self.enabled = False

    async def fetch_recent(self, limit: int = 25) -> list[dict]:
        if not self.enabled:
            return []

        def _read() -> list[dict]:
            docs = firestore.client().collection(self.collection_name).limit(limit).stream()
            return [{"id": doc.id, **doc.to_dict()} for doc in docs]

        try:
            return await asyncio.to_thread(_read)
        except Exception as error:
            logger.warning("Firestore read failed. Falling back to local mode. Details: %s", error)
            self.enabled = False
            return []
