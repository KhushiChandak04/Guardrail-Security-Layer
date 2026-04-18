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