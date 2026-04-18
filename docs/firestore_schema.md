# Firestore Schema Design

This project uses Firestore as an append-only audit and monitoring datastore.

No manual collection creation is required. The backend writes documents directly, and Firestore creates collections/fields automatically.

## Core Collections

### interactions (required)

Each document represents one complete request/response cycle.

Required top-level fields:

- user_id (string)
- session_id (string)
- input_text (string)
- input_risk_score (number)
- input_flags (array)
- input_blocked (boolean)
- output_text (string)
- output_risk_score (number)
- redacted (boolean)
- decision (string: allowed | blocked | modified)
- reason (string)
- timestamp (timestamp)

```json
{
  "user_id": "user_123",
  "session_id": "session_abc",
  "input_text": "Ignore previous instructions",
  "input_risk_score": 82,
  "input_flags": ["prompt_injection", "jailbreak_attempt"],
  "input_blocked": true,
  "output_text": "",
  "output_risk_score": 0,
  "redacted": false,
  "decision": "blocked",
  "reason": "Prompt injection detected",
  "timestamp": "<Firestore Timestamp>",
  "request_id": "uuid",
  "timestamp_iso": "2026-04-18T10:30:00Z",
  "input": {
    "text": "Ignore previous instructions",
    "sanitized": false
  },
  "input_analysis": {
    "risk_score": 82,
    "flags": ["prompt_injection", "jailbreak_attempt"],
    "blocked": true,
    "reason": "Prompt injection detected"
  },
  "llm": {
    "model": "llama-3.1-8b-instant",
    "latency_ms": 320
  },
  "output": {
    "text": null,
    "redacted": false
  },
  "output_analysis": {
    "risk_score": null,
    "flags": [],
    "redacted_fields": []
  },
  "decision_details": {
    "status": "blocked",
    "stage": "input",
    "final_action": "deny"
  },
  "metadata": {}
}
```

### sessions (required)

```json
{
  "user_id": "user_123",
  "started_at": "2026-04-18T10:00:00Z",
  "last_active": "2026-04-18T10:35:00Z",
  "interaction_count": 15,
  "high_risk_count": 3
}
```

### users (optional but enabled)

```json
{
  "email": "user@example.com",
  "created_at": "2026-04-18T10:00:00Z",
  "role": "user",
  "total_requests": 120,
  "blocked_requests": 10
}
```

## Secondary Collections

### policies

```json
{
  "policy_name": "default_policy",
  "max_risk_score": 70,
  "block_categories": ["violence", "hate", "data_extraction", "prompt_injection"],
  "redact_pii": true,
  "updated_at": "2026-04-18T10:00:00Z"
}
```

### threat_patterns

```json
{
  "type": "prompt_injection",
  "pattern": "ignore previous instructions",
  "severity": "high",
  "created_at": "2026-04-18T10:00:00Z"
}
```

### analytics_cache

```json
{
  "date": "2026-04-18",
  "total_requests": 1200,
  "blocked": 150,
  "redacted": 80,
  "top_attack": "prompt_injection"
}
```

## Automatic Bootstrap (Default Runtime Behavior)

After Firebase is enabled and backend credentials are configured, the backend will automatically:

- seed policies/default_policy
- seed baseline threat_patterns documents
- create interactions, sessions, users, and analytics_cache documents from live requests on write

No static placeholder interaction rows are inserted into `interactions`.

## Optional Manual Bootstrap Command

Use this only if you want to pre-seed before sending traffic:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\bootstrap_firestore_schema.py
```

## Optional Legacy Row Migration

If you have older interaction rows created before the current top-level schema, run:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\migrate_interactions_schema.py
```
