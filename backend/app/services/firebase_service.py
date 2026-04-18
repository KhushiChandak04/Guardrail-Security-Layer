import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

from firebase_admin import firestore

from app.guardrails.input.regex_rules import export_threat_patterns
from firebase_config import get_firestore_db

logger = logging.getLogger(__name__)


class FirebaseService:
    def __init__(
        self,
        *,
        project_id: str,
        credentials_path: str,
        jailbreak_seed_file: str,
        ingress_block_threshold: int,
        ingress_sanitize_threshold: int,
        jailbreak_similarity_threshold: float,
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
        self.jailbreak_seed_file = jailbreak_seed_file
        self.ingress_block_threshold = max(0, min(100, ingress_block_threshold))
        self.ingress_sanitize_threshold = max(0, min(100, ingress_sanitize_threshold))
        self.jailbreak_similarity_threshold = max(0.0, min(1.0, jailbreak_similarity_threshold))
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

    def _read_seed_threat_patterns(self) -> list[str]:
        if not self.jailbreak_seed_file:
            return []

        seed_path = Path(self.jailbreak_seed_file)
        if not seed_path.exists():
            logger.warning("Jailbreak seed file not found during Firebase sync: %s", seed_path)
            return []

        patterns: list[str] = []
        for line in seed_path.read_text(encoding="utf-8").splitlines():
            clean_line = line.strip()
            if clean_line and not clean_line.startswith("[") and not clean_line.startswith("#"):
                patterns.append(clean_line)

        return patterns

    def _build_threat_pattern_documents(self, timestamp: str) -> list[dict[str, str]]:
        documents: list[dict[str, str]] = []
        seen_patterns: set[str] = set()

        for pattern_doc in export_threat_patterns():
            pattern_value = pattern_doc.get("pattern", "").strip()
            if not pattern_value:
                continue

            normalized = pattern_value.lower()
            if normalized in seen_patterns:
                continue

            seen_patterns.add(normalized)
            documents.append(
                {
                    "id": pattern_doc["id"],
                    "type": pattern_doc["type"],
                    "pattern": pattern_value,
                    "severity": pattern_doc["severity"],
                    "source": pattern_doc.get("source", "logic_regex"),
                    "created_at": timestamp,
                }
            )

        for seed_pattern in self._read_seed_threat_patterns():
            normalized = seed_pattern.lower()
            if normalized in seen_patterns:
                continue

            seen_patterns.add(normalized)
            pattern_hash = hashlib.sha1(seed_pattern.encode("utf-8")).hexdigest()[:12]
            documents.append(
                {
                    "id": f"seed-{pattern_hash}",
                    "type": "jailbreak_seed",
                    "pattern": seed_pattern,
                    "severity": "high",
                    "source": "logic_seed_file",
                    "created_at": timestamp,
                }
            )

        return documents

    async def bootstrap_schema(self) -> bool:
        if not self.enabled:
            return False

        timestamp = datetime.now(timezone.utc).isoformat()
        db = self.db

        def _seed() -> None:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            threat_patterns = self._build_threat_pattern_documents(timestamp)
            block_categories = sorted({pattern["type"] for pattern in threat_patterns})

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
                    "max_risk_score": self.ingress_block_threshold,
                    "sanitize_risk_score": self.ingress_sanitize_threshold,
                    "jailbreak_similarity_threshold": self.jailbreak_similarity_threshold,
                    "block_categories": block_categories,
                    "redact_pii": True,
                    "updated_at": timestamp,
                },
                merge=True,
            )

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

    def _runtime_guardrail_snapshot(self) -> dict[str, object]:
        threat_patterns = self._build_threat_pattern_documents(datetime.now(timezone.utc).isoformat())
        block_categories = sorted({pattern["type"] for pattern in threat_patterns})

        return {
            "source": "runtime",
            "policy_document_found": False,
            "policy": {
                "max_risk_score": self.ingress_block_threshold,
                "sanitize_risk_score": self.ingress_sanitize_threshold,
                "jailbreak_similarity_threshold": self.jailbreak_similarity_threshold,
                "block_categories": block_categories,
                "redact_pii": True,
            },
            "threat_pattern_count": len(threat_patterns),
        }

    async def fetch_guardrail_snapshot(self) -> dict[str, object]:
        if not self.enabled:
            return self._runtime_guardrail_snapshot()

        db = self.db

        def _read_snapshot() -> tuple[bool, dict, int]:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            policy_ref = db.collection(self.policies_collection).document("default_policy")
            policy_snapshot = policy_ref.get()
            policy_data = policy_snapshot.to_dict() if policy_snapshot.exists else {}

            threat_count = 0
            for _ in db.collection(self.threat_patterns_collection).stream():
                threat_count += 1

            return bool(policy_snapshot.exists), policy_data, threat_count

        try:
            policy_exists, policy_data, threat_count = await asyncio.to_thread(_read_snapshot)
        except Exception as error:
            logger.warning("Failed to fetch guardrail snapshot from Firestore. Falling back to runtime snapshot. Details: %s", error)
            self.enabled = False
            return self._runtime_guardrail_snapshot()

        runtime_snapshot = self._runtime_guardrail_snapshot()
        runtime_policy = runtime_snapshot["policy"] if isinstance(runtime_snapshot.get("policy"), dict) else {}

        categories = policy_data.get("block_categories", runtime_policy.get("block_categories", []))
        if isinstance(categories, list):
            normalized_categories = sorted({str(category) for category in categories if str(category)})
        else:
            normalized_categories = list(runtime_policy.get("block_categories", []))

        policy = {
            "max_risk_score": int(policy_data.get("max_risk_score", runtime_policy.get("max_risk_score", self.ingress_block_threshold))),
            "sanitize_risk_score": int(policy_data.get("sanitize_risk_score", runtime_policy.get("sanitize_risk_score", self.ingress_sanitize_threshold))),
            "jailbreak_similarity_threshold": float(
                policy_data.get(
                    "jailbreak_similarity_threshold",
                    runtime_policy.get("jailbreak_similarity_threshold", self.jailbreak_similarity_threshold),
                )
            ),
            "block_categories": normalized_categories,
            "redact_pii": bool(policy_data.get("redact_pii", runtime_policy.get("redact_pii", True))),
        }

        return {
            "source": "firestore",
            "policy_document_found": policy_exists,
            "policy": policy,
            "threat_pattern_count": int(threat_count),
        }

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
        input_sanitized: bool,
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
                "sanitized": input_sanitized,
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
            input_sanitized=False,
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
