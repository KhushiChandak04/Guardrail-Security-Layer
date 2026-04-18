# # import re

# # from app.config.constants import INPUT_JAILBREAK_PATTERNS

# # COMPILED_INPUT_PATTERNS = [
# #     (re.compile(pattern, re.IGNORECASE), label) for pattern, label in INPUT_JAILBREAK_PATTERNS
# # ]
# import re

# SECRET_REGEXES = [
#     (re.compile(r"(?i)api[_-]?key[\s:=]+['\"a-zA-Z0-9_-]{10,}"), "API Key"),
#     (re.compile(r"(?i)aws[_-]?access[_-]?key[_-]?id[\s:=]+[A-Z0-9]{20}"), "AWS Access Key"),
#     (re.compile(r"(?i)password[\s:=]+['\"][^'\"]+['\"]"), "Plaintext Password")
# ]
# EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
# PHONE_REGEX = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")

# def detect_secrets_and_pii(text: str) -> list[str]:
#     reasons = []
    
#     for pattern, label in SECRET_REGEXES:
#         if pattern.search(text):
#             reasons.append(f"Secret detected: {label}")
            
#     if EMAIL_REGEX.search(text):
#         reasons.append("PII detected: Email Address")
        
#     for candidate in PHONE_REGEX.findall(text):
#         if 10 <= len(re.sub(r"\D", "", candidate)) <= 15:
#             reasons.append("PII detected: Phone Number")
#             break 
            
#     return reasons
import re

SECRET_PATTERNS = [
    (re.compile(r"(?i)(api[_-]?key|secret[_-]?key|access[_-]?token)\\s*[:=]\\s*['\"A-Za-z0-9_\-]{8,}"), "credential_token_exposure", 95),
    (re.compile(r"(?i)-----begin\\s+(rsa|ec|dsa)?\\s*private\\s+key-----"), "private_key_exposure", 95),
    (re.compile(r"(?i)aws[_-]?access[_-]?key[_-]?id\\s*[:=]\\s*[A-Z0-9]{16,}"), "cloud_key_exposure", 95),
]

EMAIL_REGEX = re.compile(r"\\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}\\b")
PHONE_REGEX = re.compile(r"(?:\+?\(?\d[\d\s().-]{7,}\d)")

SYSTEM_EXTRACTION_PATTERNS = [
    (re.compile(r"\bsystem prompt\b"), "system prompt extraction"),
    (re.compile(r"\bhidden instructions\b"), "hidden instructions extraction"),
    (re.compile(r"\breveal instructions\b"), "instruction disclosure request"),
]

EXPLICIT_INJECTION_PATTERNS = [
    (re.compile(r"\b(ignore|disregard|forget)\b.*\b(all|any|previous)?\s*(rules|instructions|guidelines|restriction|restrictions|limit|limits)\b"), "explicit override intent", 70),
    (re.compile(r"\b(developer mode|jailbreak|dan)\b"), "explicit jailbreak request", 70),
    (re.compile(r"\b(bypass safety|bypass filters|disable safety)\b"), "explicit safety bypass", 70),
]

OUTPUT_DISCLOSURE_PATTERNS = [
    (re.compile(r"\bsystem prompt\b"), "system_disclosure"),
    (re.compile(r"\binternal instructions\b"), "internal_instruction_disclosure"),
    (re.compile(r"\bdeveloper message\b"), "developer_message_disclosure"),
]


def _slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return normalized.strip("-") or "pattern"

def detect_system_extraction(normalized_data: dict) -> dict:
    triggered = False
    for pattern, _label in SYSTEM_EXTRACTION_PATTERNS:
        if pattern.search(normalized_data["normalized"]):
            triggered = True
            break
            
    if not triggered:
        compact_terms = ["systemprompt", "hiddeninstructions", "revealinstructions"]
        if any(term in normalized_data["compact"] for term in compact_terms):
            triggered = True

    return {
        "triggered": triggered,
        "risk": 90 if triggered else 0,
        "reasons": ["system prompt extraction attempt"] if triggered else [],
    }

def detect_heuristic_injection(normalized_data: dict) -> dict:
    seen_reasons = set()
    risk = 0

    for clause in normalized_data["clauses"]:
        for pattern, label, weight in EXPLICIT_INJECTION_PATTERNS:
            if pattern.search(clause) and label not in seen_reasons:
                seen_reasons.add(label)
                risk = max(risk, weight)

    compact = normalized_data["compact"]
    for term, label in [("jailbreak", "explicit jailbreak"), ("developermode", "explicit jailbreak")]:
        if term in compact and label not in seen_reasons:
            seen_reasons.add(label)
            risk = max(risk, 70)

    return {"risk": risk, "reasons": list(seen_reasons)}


def detect_secrets_and_pii(normalized_data: dict) -> dict:
    raw_text = str(normalized_data.get("raw", ""))
    reasons: list[str] = []
    risk = 0

    for pattern, label, weight in SECRET_PATTERNS:
        if pattern.search(raw_text):
            reasons.append(label)
            risk = max(risk, weight)

    pii_detected = False
    if EMAIL_REGEX.search(raw_text):
        reasons.append("email_detected")
        pii_detected = True

    for candidate in PHONE_REGEX.findall(raw_text):
        digits = re.sub(r"\D", "", candidate)
        if 10 <= len(digits) <= 15:
            reasons.append("phone_number_detected")
            pii_detected = True
            break

    if pii_detected:
        risk = max(risk, 45)

    block = any(reason.endswith("_exposure") for reason in reasons)
    sanitize = pii_detected and not block

    return {
        "risk": risk,
        "reasons": reasons,
        "block": block,
        "sanitize": sanitize,
    }


def detect_output_disclosure(text: str) -> dict:
    lowered = text.lower()
    reasons: list[str] = []

    for pattern, label in OUTPUT_DISCLOSURE_PATTERNS:
        if pattern.search(lowered):
            reasons.append(label)

    return {
        "triggered": bool(reasons),
        "reasons": reasons,
        "risk": 90 if reasons else 0,
    }


def export_threat_patterns() -> list[dict[str, str]]:
    patterns: list[dict[str, str]] = []

    for compiled, label in SYSTEM_EXTRACTION_PATTERNS:
        patterns.append(
            {
                "id": f"logic-system-{_slugify(label)}",
                "type": "system_extraction",
                "pattern": compiled.pattern,
                "severity": "high",
                "source": "logic_regex",
            }
        )

    for compiled, label, weight in EXPLICIT_INJECTION_PATTERNS:
        patterns.append(
            {
                "id": f"logic-injection-{_slugify(label)}",
                "type": "prompt_injection",
                "pattern": compiled.pattern,
                "severity": "high" if weight >= 70 else "medium",
                "source": "logic_regex",
            }
        )

    for compiled, label, weight in SECRET_PATTERNS:
        patterns.append(
            {
                "id": f"logic-secret-{_slugify(label)}",
                "type": "secret_exposure",
                "pattern": compiled.pattern,
                "severity": "high" if weight >= 90 else "medium",
                "source": "logic_regex",
            }
        )

    return patterns