import re

AADHAAR_PATTERN = re.compile(r"\b\d{4}[ ]?\d{4}[ ]?\d{4}\b")
PAN_PATTERN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(
    r"(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?(?:[6-9]\d{9}|\d{6,14})\b"
)

CONFIDENTIAL_KEYWORDS = [
    "confidential",
    "classified",
    "internal use only",
    "restricted",
    "private document",
]

MASK_AADHAAR = "<AADHAAR_MASKED>"
MASK_EMAIL = "<EMAIL_MASKED>"
MASK_PHONE = "<PHONE_MASKED>"
MASK_PAN = "<PAN_MASKED>"
MASK_CONFIDENTIAL_DOCUMENT = "[REDACTED CONFIDENTIAL DOCUMENT]"


def _has_match(text: str, pattern: re.Pattern[str]) -> bool:
    return bool(pattern.search(text))


def _has_confidential_keyword(text: str) -> bool:
    lowered = text.lower()
    return any(keyword in lowered for keyword in CONFIDENTIAL_KEYWORDS)


def _detect_types(text: str) -> set[str]:
    detected: set[str] = set()

    if _has_match(text, AADHAAR_PATTERN):
        detected.add("aadhaar")
    if _has_match(text, PAN_PATTERN):
        detected.add("pan")
    if _has_match(text, EMAIL_PATTERN):
        detected.add("email")
    if _has_match(text, PHONE_PATTERN):
        detected.add("phone")
    if _has_confidential_keyword(text):
        detected.add("confidential")

    return detected


def _compute_risk(detected: set[str]) -> str:
    if "aadhaar" in detected or "pan" in detected or "confidential" in detected:
        return "HIGH"
    if "email" in detected or "phone" in detected:
        return "MEDIUM"
    return "LOW"


def _compute_action(risk: str) -> str:
    if risk == "HIGH":
        return "BLOCK"
    if risk == "MEDIUM":
        return "MASK"
    return "ALLOW"


def _mask_standard(text: str) -> str:
    masked = text
    masked = AADHAAR_PATTERN.sub(MASK_AADHAAR, masked)
    masked = PAN_PATTERN.sub(MASK_PAN, masked)
    masked = EMAIL_PATTERN.sub(MASK_EMAIL, masked)
    masked = PHONE_PATTERN.sub(MASK_PHONE, masked)
    return masked


def _sanitize_for_scan_output(text: str, detected: set[str], risk: str) -> str:
    if risk == "HIGH" and "confidential" in detected:
        return MASK_CONFIDENTIAL_DOCUMENT

    masked = _mask_standard(text)
    masked = re.sub(r"\n{3,}", "\n\n", masked)
    masked = re.sub(r"[ \t]{2,}", " ", masked)
    return masked.strip()


def _message_labels(detected: set[str]) -> str:
    order = ["aadhaar", "pan", "email", "phone", "confidential"]
    display_map = {
        "aadhaar": "Aadhaar",
        "pan": "PAN",
        "email": "Email",
        "phone": "Phone",
        "confidential": "Confidential",
    }
    labels = [display_map[item] for item in order if item in detected]
    return ", ".join(labels)


def _build_message(risk: str, detected: set[str]) -> str:
    if risk == "LOW":
        return "No sensitive information detected. Safe to send to AI."

    labels = _message_labels(detected)
    if risk == "HIGH":
        return f"Highly sensitive data detected ({labels}). Upload blocked for security."

    return (
        f"Personal data detected ({labels}). "
        "Data will be masked before sending to AI."
    )


def scan_document(text: str) -> dict[str, object]:
    raw_text = text or ""
    detected = _detect_types(raw_text)
    risk = _compute_risk(detected)
    action = _compute_action(risk)
    sanitized_text = _sanitize_for_scan_output(raw_text, detected, risk)

    return {
        "risk": risk,
        "detected": sorted(detected),
        "action": action,
        "message": _build_message(risk, detected),
        "sanitized_text": sanitized_text,
    }


def sanitize_document_text(text: str, *, remove_high_risk_identifiers: bool = True) -> str:
    sanitized = text or ""

    # Keep confidential documents fully redacted for any downstream AI use.
    if _has_confidential_keyword(sanitized):
        return MASK_CONFIDENTIAL_DOCUMENT

    sanitized = EMAIL_PATTERN.sub(MASK_EMAIL, sanitized)
    sanitized = PHONE_PATTERN.sub(MASK_PHONE, sanitized)

    if remove_high_risk_identifiers:
        sanitized = AADHAAR_PATTERN.sub("", sanitized)
        sanitized = PAN_PATTERN.sub("", sanitized)
    else:
        sanitized = AADHAAR_PATTERN.sub(MASK_AADHAAR, sanitized)
        sanitized = PAN_PATTERN.sub(MASK_PAN, sanitized)

    sanitized = re.sub(r"\n{3,}", "\n\n", sanitized)
    sanitized = re.sub(r"[ \t]{2,}", " ", sanitized)
    return sanitized.strip()
