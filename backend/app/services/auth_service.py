import asyncio

import firebase_admin
from firebase_admin import auth


class AuthService:
    async def verify_id_token(self, id_token: str | None) -> dict[str, str]:
        if not id_token:
            return {"uid": "anonymous"}

        if not firebase_admin._apps:
            return {"uid": "token-not-verified"}

        try:
            decoded = await asyncio.to_thread(auth.verify_id_token, id_token)
            return {
                "uid": str(decoded.get("uid", "unknown")),
                "email": str(decoded.get("email", "")),
            }
        except Exception:
            return {"uid": "invalid-token"}
