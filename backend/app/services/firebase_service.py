import asyncio
import logging
from datetime import datetime, timezone

from firebase_admin import firestore

from firebase_config import get_firestore_db

logger = logging.getLogger(__name__)


class FirebaseService:
    def __init__(
        self,
        *,
        project_id: str,
        credentials_path: str,
        interactions_collection: str,
        sessions_collection: str,
        users_collection: str,
        policies_collection: str,
        threat_patterns_collection: str,
        analytics_cache_collection: str,
    ) -> None:
        self.enabled = False
        self.interactions_collection = interactions_collection
        self.sessions_collection = sessions_collection
        self.users_collection = users_collection
        self.policies_collection = policies_collection
        self.threat_patterns_collection = threat_patterns_collection
        self.analytics_cache_collection = analytics_cache_collection
        self.local_interactions: list[dict] = []
        self._schema_bootstrapped = False
        self.db = None

        if not credentials_path:
            logger.info("Firebase credentials are not configured. Using local logging mode.")
            return

        try:
            self.db = get_firestore_db(credentials_path=credentials_path, project_id=project_id)
            self.enabled = self.db is not None
        except Exception as error:
            logger.warning("Firebase not configured. Logging will stay local. Details: %s", error)
            self.enabled = False

    def _risk_score_from_level(self, level: str | None) -> int | None:
        if not level:
            return None
        normalized = level.lower()
        if normalized == "high":
            return 85
        if normalized == "medium":
            return 60
        if normalized == "low":
            return 25
        return None

    def _derive_input_flags(self, reason: str, blocked: bool) -> list[str]:
        lowered = reason.lower()
        flags: list[str] = []

        if "prompt injection" in lowered:
            flags.append("prompt_injection")
        if "jailbreak" in lowered:
            flags.append("jailbreak_attempt")
        if "toxicity" in lowered or "harmful" in lowered:
            flags.append("toxicity")
        if blocked and not flags:
            flags.append("policy_violation")

        return flags

    def _derive_output_flags(self, redactions: list[str], output_risk_level: str | None) -> list[str]:
        flags: list[str] = []
        if redactions:
            flags.append("pii_detected")

        if output_risk_level == "high":
            flags.append("unsafe_output")
        elif output_risk_level == "medium":
            flags.append("needs_review")

        return flags

    def _coerce_timestamp(self, timestamp: str | None) -> datetime:
        if timestamp:
            try:
                parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=timezone.utc)
                return parsed
            except ValueError:
                pass

        return datetime.now(timezone.utc)

    async def bootstrap_schema(self) -> bool:
        if not self.enabled:
            return False

        timestamp = datetime.now(timezone.utc).isoformat()
        db = self.db

        def _seed() -> None:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            # Remove legacy placeholder documents so collections contain only live data.
            for collection_name in [
                self.interactions_collection,
                self.sessions_collection,
                self.users_collection,
                self.analytics_cache_collection,
            ]:
                legacy_ref = db.collection(collection_name).document("_schema")
                if legacy_ref.get().exists:
                    legacy_ref.delete()

            db.collection(self.policies_collection).document("default_policy").set(
                {
                    "policy_name": "default_policy",
                    "max_risk_score": 70,
                    "block_categories": [
                        "violence",
                        "hate",
                        "data_extraction",
                        "prompt_injection",
                    ],
                    "redact_pii": True,
                    "updated_at": timestamp,
                },
                merge=True,
            )

            threat_patterns = [
                {
                    "id": "prompt-injection-ignore-previous-instructions",
                    "type": "prompt_injection",
                    "pattern": "ignore previous instructions",
                    "severity": "high",
                    "created_at": timestamp,
                },
                {
                    "id": "jailbreak-reveal-system-prompt",
                    "type": "jailbreak_attempt",
                    "pattern": "reveal system prompt",
                    "severity": "high",
                    "created_at": timestamp,
                },
                {
                    "id": "safety-bypass",
                    "type": "policy_violation",
                    "pattern": "bypass safety",
                    "severity": "medium",
                    "created_at": timestamp,
                },
            ]

            for pattern in threat_patterns:
                doc_id = pattern["id"]
                payload = {key: value for key, value in pattern.items() if key != "id"}
                db.collection(self.threat_patterns_collection).document(doc_id).set(payload, merge=True)

        try:
            await asyncio.to_thread(_seed)
            self._schema_bootstrapped = True
            return True
        except Exception as error:
            logger.warning("Failed to bootstrap Firestore schema: %s", error)
            self._schema_bootstrapped = False
            return False

    async def ensure_schema_initialized(self) -> bool:
        if not self.enabled:
            return False

        if self._schema_bootstrapped:
            return True

        return await self.bootstrap_schema()

    async def sync_user_profile(
        self,
        *,
        user_id: str,
        user_email: str,
        display_name: str | None = None,
    ) -> bool:
        if not user_id or user_id in {"anonymous", "token-not-verified", "invalid-token", "unknown"}:
            return False

        if not self.enabled:
            return False

        await self.ensure_schema_initialized()

        db = self.db
        timestamp = datetime.now(timezone.utc)

        def _write_user_profile() -> None:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            user_ref = db.collection(self.users_collection).document(user_id)
            user_snapshot = user_ref.get()
            existing_user = user_snapshot.to_dict() if user_snapshot.exists else {}

            payload: dict[str, object] = {
                "email": user_email,
                "role": existing_user.get("role", "user"),
                "created_at": existing_user.get("created_at", timestamp),
                "last_login_at": timestamp,
            }

            if display_name:
                payload["display_name"] = display_name

            user_ref.set(payload, merge=True)

        try:
            await asyncio.to_thread(_write_user_profile)
            return True
        except Exception as error:
            logger.warning("Firestore user sync failed. Details: %s", error)
            return False

    async def log_interaction(
        self,
        *,
        user_id: str,
        user_email: str,
        session_id: str | None,
        prompt_text: str,
        input_risk_level: str,
        input_reason: str,
        blocked: bool,
        model: str,
        llm_latency_ms: int | None,
        output_text: str | None,
        output_risk_level: str | None,
        redactions: list[str],
        metadata: dict[str, str],
        request_id: str,
        timestamp: str,
    ) -> None:
        input_flags = self._derive_input_flags(input_reason, blocked)
        output_flags = [] if blocked else self._derive_output_flags(redactions, output_risk_level)
        input_risk_score = self._risk_score_from_level(input_risk_level)
        output_risk_score = None if blocked else self._risk_score_from_level(output_risk_level)
        input_risk_score_value = int(input_risk_score or 0)
        output_risk_score_value = int(output_risk_score or 0)
        resolved_session_id = session_id or f"{user_id}-default"
        is_redacted = bool(redactions)
        interaction_timestamp = self._coerce_timestamp(timestamp)

        if blocked:
            decision_status = "blocked"
            decision_stage = "input"
            final_action = "deny"
            reason = input_reason or "prompt injection detected"
        elif is_redacted:
            decision_status = "modified"
            decision_stage = "output"
            final_action = "redact"
            reason = "PII removed"
        else:
            decision_status = "allowed"
            decision_stage = "output"
            final_action = "allow"
            reason = "safe"

        output_text_value = "" if blocked else (output_text or "")

        payload = {
            # Required top-level interaction fields.
            "user_id": user_id,
            "session_id": resolved_session_id,
            "input_text": prompt_text,
            "input_risk_score": input_risk_score_value,
            "input_flags": input_flags,
            "input_blocked": blocked,
            "output_text": output_text_value,
            "output_risk_score": output_risk_score_value,
            "redacted": is_redacted,
            "decision": decision_status,
            "reason": reason,
            "timestamp": interaction_timestamp,
            # Backward-compatible expanded fields.
            "request_id": request_id,
            "timestamp_iso": interaction_timestamp.isoformat(),
            "input": {
                "text": prompt_text,
                "sanitized": False,
            },
            "input_analysis": {
                "risk_score": input_risk_score_value,
                "flags": input_flags,
                "blocked": blocked,
                "reason": input_reason,
            },
            "llm": {
                "model": model,
                "latency_ms": max(int(llm_latency_ms or 0), 0),
            },
            "output": {
                "text": output_text_value,
                "redacted": is_redacted,
            },
            "output_analysis": {
                "risk_score": output_risk_score_value,
                "flags": output_flags,
                "redacted_fields": [] if blocked else redactions,
            },
            "decision_details": {
                "status": decision_status,
                "stage": decision_stage,
                "final_action": final_action,
            },
            "metadata": metadata,
        }

        if not self.enabled:
            self.local_interactions.insert(0, {"id": request_id, **payload})
            self.local_interactions = self.local_interactions[:250]
            return

        await self.ensure_schema_initialized()

        is_high_risk = (input_risk_score or 0) >= 70 or (output_risk_score or 0) >= 70
        db = self.db

        def _write() -> None:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            db.collection(self.interactions_collection).document(request_id).set(payload)

            session_ref = db.collection(self.sessions_collection).document(resolved_session_id)
            session_snapshot = session_ref.get()
            existing_session = session_snapshot.to_dict() if session_snapshot.exists else {}
            session_ref.set(
                {
                    "user_id": user_id,
                    "started_at": existing_session.get("started_at", interaction_timestamp),
                    "last_active": interaction_timestamp,
                    "interaction_count": firestore.Increment(1),
                    "high_risk_count": firestore.Increment(1 if is_high_risk else 0),
                },
                merge=True,
            )

            if user_id and user_id not in {"anonymous", "token-not-verified", "invalid-token"}:
                user_ref = db.collection(self.users_collection).document(user_id)
                user_snapshot = user_ref.get()
                existing_user = user_snapshot.to_dict() if user_snapshot.exists else {}
                user_ref.set(
                    {
                        "email": user_email,
                        "created_at": existing_user.get("created_at", interaction_timestamp),
                        "role": existing_user.get("role", "user"),
                        "total_requests": firestore.Increment(1),
                        "blocked_requests": firestore.Increment(1 if blocked else 0),
                    },
                    merge=True,
                )

            date_key = interaction_timestamp.date().isoformat()
            analytics_ref = db.collection(self.analytics_cache_collection).document(date_key)
            analytics_update = {
                "date": date_key,
                "total_requests": firestore.Increment(1),
                "blocked": firestore.Increment(1 if blocked else 0),
                "redacted": firestore.Increment(1 if is_redacted else 0),
            }
            if input_flags:
                analytics_update[f"attack_counts.{input_flags[0]}"] = firestore.Increment(1)
                analytics_update["top_attack"] = input_flags[0]
            analytics_ref.set(analytics_update, merge=True)

        try:
            await asyncio.to_thread(_write)
        except Exception as error:
            logger.warning("Firestore write failed. Falling back to local mode. Details: %s", error)
            self.enabled = False
            self.local_interactions.insert(0, {"id": request_id, **payload})
            self.local_interactions = self.local_interactions[:250]

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
        # Backward-compatible wrapper for older call sites.
        await self.log_interaction(
            user_id=user_id,
            user_email="",
            session_id=session_id,
            prompt_text=prompt_preview,
            input_risk_level=ingress_risk,
            input_reason=reason,
            blocked=blocked,
            model=model,
            llm_latency_ms=0,
            output_text=response_preview,
            output_risk_level=output_risk,
            redactions=redactions,
            metadata=metadata,
            request_id=request_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def fetch_recent(self, limit: int = 25) -> list[dict]:
        if not self.enabled:
            return self.local_interactions[:limit]

        db = self.db

        def _read() -> list[dict]:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            docs = (
                db
                .collection(self.interactions_collection)
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream()
            )

            items = [{"id": doc.id, **doc.to_dict()} for doc in docs]
            return [
                item
                for item in items
                if isinstance(item.get("input_text"), str) and bool(item.get("input_text"))
            ]

        try:
            return await asyncio.to_thread(_read)
        except Exception as error:
            logger.warning("Firestore read failed. Falling back to local mode. Details: %s", error)
            self.enabled = False
            return self.local_interactions[:limit]
