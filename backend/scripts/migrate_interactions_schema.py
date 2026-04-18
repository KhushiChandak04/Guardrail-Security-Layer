from __future__ import annotations

from datetime import datetime, timezone

from firebase_config import get_firestore_db


def _as_datetime(value) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                return parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            pass

    return datetime.now(timezone.utc)


def _resolve_decision(data: dict) -> str:
    decision = data.get("decision")
    if isinstance(decision, str) and decision:
        return decision

    if isinstance(decision, dict):
        status = decision.get("status")
        if isinstance(status, str) and status:
            return status

    details = data.get("decision_details")
    if isinstance(details, dict):
        status = details.get("status")
        if isinstance(status, str) and status:
            return status

    input_analysis = data.get("input_analysis") if isinstance(data.get("input_analysis"), dict) else {}
    output = data.get("output") if isinstance(data.get("output"), dict) else {}

    if bool(input_analysis.get("blocked")):
        return "blocked"
    if bool(output.get("redacted")):
        return "modified"
    return "allowed"


def _resolve_reason(data: dict, decision: str) -> str:
    reason = data.get("reason")
    if isinstance(reason, str) and reason:
        return reason

    input_analysis = data.get("input_analysis") if isinstance(data.get("input_analysis"), dict) else {}
    input_reason = input_analysis.get("reason")
    if isinstance(input_reason, str) and input_reason:
        return input_reason

    if decision == "blocked":
        return "prompt injection detected"
    if decision == "modified":
        return "PII removed"
    return "safe"


def _as_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def main() -> None:
    db = get_firestore_db()
    docs = list(db.collection("interactions").stream())
    updated_count = 0

    for doc in docs:
        data = doc.to_dict() or {}

        input_section = data.get("input") if isinstance(data.get("input"), dict) else {}
        output_section = data.get("output") if isinstance(data.get("output"), dict) else {}
        input_analysis = data.get("input_analysis") if isinstance(data.get("input_analysis"), dict) else {}
        output_analysis = data.get("output_analysis") if isinstance(data.get("output_analysis"), dict) else {}

        input_text = data.get("input_text")
        if not isinstance(input_text, str) or not input_text:
            nested_input_text = input_section.get("text")
            input_text = nested_input_text if isinstance(nested_input_text, str) else ""

        if not input_text:
            # Skip non-interaction rows that do not contain user input text.
            continue

        output_text = data.get("output_text")
        if not isinstance(output_text, str):
            nested_output_text = output_section.get("text")
            output_text = nested_output_text if isinstance(nested_output_text, str) else ""

        input_flags = data.get("input_flags")
        if not isinstance(input_flags, list):
            nested_flags = input_analysis.get("flags")
            input_flags = nested_flags if isinstance(nested_flags, list) else []

        input_blocked = data.get("input_blocked")
        if not isinstance(input_blocked, bool):
            input_blocked = bool(input_analysis.get("blocked"))

        redacted = data.get("redacted")
        if not isinstance(redacted, bool):
            redacted = bool(output_section.get("redacted"))

        decision = _resolve_decision(data)
        reason = _resolve_reason(data, decision)

        timestamp = _as_datetime(data.get("timestamp"))

        patch = {
            "user_id": str(data.get("user_id", "anonymous")),
            "session_id": str(data.get("session_id", "anonymous-default")),
            "input_text": input_text,
            "input_risk_score": _as_int(data.get("input_risk_score", input_analysis.get("risk_score"))),
            "input_flags": input_flags,
            "input_blocked": input_blocked,
            "output_text": output_text,
            "output_risk_score": _as_int(data.get("output_risk_score", output_analysis.get("risk_score"))),
            "redacted": redacted,
            "decision": decision,
            "reason": reason,
            "timestamp": timestamp,
        }

        doc.reference.set(patch, merge=True)
        updated_count += 1

    print(f"Migration complete. Updated {updated_count} interaction documents.")


if __name__ == "__main__":
    main()