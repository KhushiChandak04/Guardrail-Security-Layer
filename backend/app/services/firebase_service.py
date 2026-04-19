import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path

from firebase_admin import firestore
try:
    from google.cloud.firestore_v1.base_query import FieldFilter
except Exception:  # pragma: no cover - compatibility fallback
    FieldFilter = None

from app.guardrails.input.regex_rules import export_threat_patterns
from firebase_config import get_firestore_db

logger = logging.getLogger(__name__)
INVALID_USER_SCOPES = {"", "anonymous", "unknown", "token-not-verified", "invalid-token"}


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
        self._local_policy_overrides: dict[str, object] = {}
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

    def _normalize_risk_score(self, value: float | int | str | None) -> float | None:
        if value is None:
            return None

        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None

        return max(0.0, min(100.0, parsed))

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
        policy = {
            "max_risk_score": self.ingress_block_threshold,
            "sanitize_risk_score": self.ingress_sanitize_threshold,
            "jailbreak_similarity_threshold": self.jailbreak_similarity_threshold,
            "block_categories": block_categories,
            "blocked_topics": [],
            "pii_detection": {},
            "redact_pii": True,
            "honeypot_mode": False,
            "multi_turn_tracking": True,
        }

        for key, value in self._local_policy_overrides.items():
            policy[key] = value

        return {
            "source": "runtime",
            "policy_document_found": False,
            "policy": policy,
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
        input_risk_score: float | None,
        input_reason: str,
        blocked: bool,
        model: str,
        llm_latency_ms: int | None,
        output_text: str | None,
        output_risk_level: str | None,
        output_risk_score: float | None,
        redactions: list[str],
        metadata: dict[str, str],
        request_id: str,
        timestamp: str,
    ) -> None:
        input_flags = self._derive_input_flags(input_reason, blocked)
        output_flags = [] if blocked else self._derive_output_flags(redactions, output_risk_level)

        fallback_input_score = self._risk_score_from_level(input_risk_level)
        fallback_output_score = None if blocked else self._risk_score_from_level(output_risk_level)

        input_risk_score_value = self._normalize_risk_score(input_risk_score)
        if input_risk_score_value is None:
            input_risk_score_value = self._normalize_risk_score(fallback_input_score) or 0.0

        if blocked:
            output_risk_score_value = 0.0
        else:
            output_risk_score_value = self._normalize_risk_score(output_risk_score)
            if output_risk_score_value is None:
                output_risk_score_value = self._normalize_risk_score(fallback_output_score) or 0.0

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

        is_high_risk = input_risk_score_value >= 70 or output_risk_score_value >= 70
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
            input_risk_score=None,
            input_reason=reason,
            blocked=blocked,
            model=model,
            llm_latency_ms=0,
            output_text=response_preview,
            output_risk_level=output_risk,
            output_risk_score=None,
            redactions=redactions,
            metadata=metadata,
            request_id=request_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    async def fetch_recent(self, limit: int = 25, user_id: str | None = None) -> list[dict]:
        normalized_user_id = self._normalize_user_scope(user_id)

        if not self.enabled:
            local_items = self.local_interactions
            if normalized_user_id:
                local_items = [
                    item
                    for item in local_items
                    if str(item.get("user_id", "")).strip() == normalized_user_id
                ]
            return local_items[:limit]

        db = self.db

        def _read() -> list[dict]:
            if db is None:
                raise RuntimeError("Firestore client is not initialized.")

            query = db.collection(self.interactions_collection)
            items = None

            if normalized_user_id:
                try:
                    scoped_limit = min(max(limit * 20, limit), 5000)
                    if FieldFilter is not None:
                        scoped_query = query.where(filter=FieldFilter("user_id", "==", normalized_user_id))
                    else:
                        scoped_query = query.where("user_id", "==", normalized_user_id)
                    scoped_docs = (
                        scoped_query
                        .limit(scoped_limit)
                        .stream()
                    )
                    items = [{"id": doc.id, **doc.to_dict()} for doc in scoped_docs]
                except Exception as scoped_error:
                    logger.warning(
                        "Scoped Firestore query failed for user %s. Details: %s",
                        normalized_user_id,
                        scoped_error,
                    )
                    return []

            if items is None:
                expanded_limit = min(max(limit * 8, limit), 1000)
                docs = (
                    query
                    .order_by("timestamp", direction=firestore.Query.DESCENDING)
                    .limit(expanded_limit)
                    .stream()
                )
                items = [{"id": doc.id, **doc.to_dict()} for doc in docs]

            cleaned_items = [
                item
                for item in items
                if isinstance(item.get("input_text"), str) and bool(item.get("input_text"))
            ]

            cleaned_items.sort(
                key=lambda item: self._parse_log_timestamp(item),
                reverse=True,
            )

            if normalized_user_id:
                cleaned_items = [
                    item
                    for item in cleaned_items
                    if str(item.get("user_id", "")).strip() == normalized_user_id
                ]

            return cleaned_items[:limit]

        try:
            return await asyncio.to_thread(_read)
        except Exception as error:
            logger.warning("Firestore read failed. Falling back to local mode. Details: %s", error)
            self.enabled = False
            local_items = self.local_interactions
            if normalized_user_id:
                local_items = [
                    item
                    for item in local_items
                    if str(item.get("user_id", "")).strip() == normalized_user_id
                ]
            return local_items[:limit]

    async def fetch_policy_config(self) -> dict[str, object]:
        snapshot = await self.fetch_guardrail_snapshot()
        policy_data = snapshot.get("policy")
        if not isinstance(policy_data, dict):
            policy_data = {}

        block_categories = policy_data.get("block_categories", [])
        if isinstance(block_categories, list):
            normalized_categories = sorted({str(item) for item in block_categories if str(item)})
        else:
            normalized_categories = []

        blocked_topics = policy_data.get("blocked_topics", [])
        if isinstance(blocked_topics, list):
            normalized_topics = sorted({str(item).strip() for item in blocked_topics if str(item).strip()})
        else:
            normalized_topics = []

        raw_pii_detection = policy_data.get("pii_detection", {})
        pii_detection: dict[str, bool] = {}
        if isinstance(raw_pii_detection, dict):
            pii_detection = {
                str(key): bool(value)
                for key, value in raw_pii_detection.items()
                if str(key).strip()
            }

        return {
            "source": snapshot.get("source", "runtime"),
            "policy_document_found": bool(snapshot.get("policy_document_found", False)),
            "policy": {
                "max_risk_score": int(policy_data.get("max_risk_score", self.ingress_block_threshold)),
                "sanitize_risk_score": int(policy_data.get("sanitize_risk_score", self.ingress_sanitize_threshold)),
                "jailbreak_similarity_threshold": float(
                    policy_data.get("jailbreak_similarity_threshold", self.jailbreak_similarity_threshold)
                ),
                "block_categories": normalized_categories,
                "blocked_topics": normalized_topics,
                "pii_detection": pii_detection,
                "redact_pii": bool(policy_data.get("redact_pii", True)),
                "honeypot_mode": bool(policy_data.get("honeypot_mode", False)),
                "multi_turn_tracking": bool(policy_data.get("multi_turn_tracking", True)),
            },
        }

    async def update_policy_config(
        self,
        *,
        max_risk_score: int,
        sanitize_risk_score: int,
        redact_pii: bool,
        block_categories: list[str],
        blocked_topics: list[str],
        pii_detection: dict[str, bool],
        honeypot_mode: bool,
        multi_turn_tracking: bool,
    ) -> dict[str, object]:
        normalized_max = max(0, min(100, int(max_risk_score)))
        normalized_sanitize = max(0, min(normalized_max, int(sanitize_risk_score)))
        normalized_categories = sorted({category.strip() for category in block_categories if category.strip()})
        normalized_topics = sorted({topic.strip() for topic in blocked_topics if topic.strip()})
        normalized_pii_detection = {
            str(key): bool(value)
            for key, value in pii_detection.items()
            if str(key).strip()
        }

        # Keep runtime thresholds aligned with the latest saved policy.
        self.ingress_block_threshold = normalized_max
        self.ingress_sanitize_threshold = normalized_sanitize

        self._local_policy_overrides = {
            "max_risk_score": normalized_max,
            "sanitize_risk_score": normalized_sanitize,
            "redact_pii": bool(redact_pii),
            "block_categories": normalized_categories,
            "blocked_topics": normalized_topics,
            "pii_detection": normalized_pii_detection,
            "honeypot_mode": bool(honeypot_mode),
            "multi_turn_tracking": bool(multi_turn_tracking),
            "jailbreak_similarity_threshold": self.jailbreak_similarity_threshold,
        }

        if self.enabled:
            await self.ensure_schema_initialized()
            db = self.db
            timestamp = datetime.now(timezone.utc).isoformat()

            def _write_policy() -> None:
                if db is None:
                    raise RuntimeError("Firestore client is not initialized.")

                db.collection(self.policies_collection).document("default_policy").set(
                    {
                        "policy_name": "default_policy",
                        "max_risk_score": normalized_max,
                        "sanitize_risk_score": normalized_sanitize,
                        "jailbreak_similarity_threshold": self.jailbreak_similarity_threshold,
                        "block_categories": normalized_categories,
                        "blocked_topics": normalized_topics,
                        "pii_detection": normalized_pii_detection,
                        "redact_pii": bool(redact_pii),
                        "honeypot_mode": bool(honeypot_mode),
                        "multi_turn_tracking": bool(multi_turn_tracking),
                        "updated_at": timestamp,
                    },
                    merge=True,
                )

            try:
                await asyncio.to_thread(_write_policy)
            except Exception as error:
                logger.warning("Firestore policy update failed. Falling back to runtime mode. Details: %s", error)
                self.enabled = False

        return await self.fetch_policy_config()

    def _parse_log_timestamp(self, item: dict) -> datetime:
        raw_timestamp = item.get("timestamp_iso") or item.get("timestamp")
        if isinstance(raw_timestamp, datetime):
            if raw_timestamp.tzinfo is None:
                return raw_timestamp.replace(tzinfo=timezone.utc)
            return raw_timestamp

        if isinstance(raw_timestamp, str):
            try:
                parsed = datetime.fromisoformat(raw_timestamp.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=timezone.utc)
                return parsed
            except ValueError:
                pass

        return datetime.now(timezone.utc)

    def _normalize_user_scope(self, user_id: str | None) -> str | None:
        normalized = str(user_id or "").strip()
        if not normalized or normalized in INVALID_USER_SCOPES:
            return None
        return normalized

    async def fetch_stats(self, limit: int = 250, user_id: str | None = None) -> dict[str, object]:
        logs = await self.fetch_recent(limit=max(1, min(limit, 500)), user_id=user_id)
        now = datetime.now(timezone.utc)
        today = now.date()

        blocked = 0
        redacted = 0
        allowed = 0
        prompts_today = 0
        session_ids: set[str] = set()
        latencies: list[int] = []
        attack_counts: dict[str, int] = {}
        pii_redaction_counts: dict[str, int] = {}

        for item in logs:
            decision = str(item.get("decision", "")).lower()
            timestamp = self._parse_log_timestamp(item)
            if timestamp.date() == today:
                prompts_today += 1

            if decision == "blocked":
                blocked += 1
            elif decision == "modified" or bool(item.get("redacted", False)):
                redacted += 1
            else:
                allowed += 1

            session_id = str(item.get("session_id", "")).strip()
            if session_id:
                session_ids.add(session_id)

            llm_data = item.get("llm")
            if isinstance(llm_data, dict):
                latency_ms = llm_data.get("latency_ms")
                if isinstance(latency_ms, (int, float)):
                    latencies.append(int(latency_ms))

            input_flags = item.get("input_flags")
            if isinstance(input_flags, list):
                for flag in input_flags:
                    normalized_flag = str(flag).strip().lower()
                    if normalized_flag:
                        attack_counts[normalized_flag] = attack_counts.get(normalized_flag, 0) + 1

            output_analysis = item.get("output_analysis")
            if isinstance(output_analysis, dict):
                redacted_fields = output_analysis.get("redacted_fields")
                if isinstance(redacted_fields, list):
                    for field in redacted_fields:
                        normalized_field = str(field).strip()
                        if normalized_field:
                            pii_redaction_counts[normalized_field] = pii_redaction_counts.get(normalized_field, 0) + 1

        total = len(logs)
        clean_rate = round((allowed / total) * 100, 1) if total else 0.0
        attack_rate = round((blocked / total) * 100, 1) if total else 0.0
        avg_latency_ms = round(sum(latencies) / len(latencies), 1) if latencies else 0.0

        return {
            "source": "firestore" if self.enabled else "local",
            "recent_count": total,
            "prompts_today": prompts_today,
            "blocked": blocked,
            "pii_redacted": redacted,
            "safe_passed": allowed,
            "clean_rate": clean_rate,
            "avg_latency_ms": avg_latency_ms,
            "active_sessions": len(session_ids),
            "attack_rate": attack_rate,
            "attack_counts": attack_counts,
            "pii_redaction_counts": pii_redaction_counts,
        }
