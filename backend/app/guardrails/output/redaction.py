import re


def redact_text(text: str, entities: set[str]) -> str:
    redacted = text

    if "US_SSN" in entities:
        redacted = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_US_SSN]", redacted)

    if "EMAIL_ADDRESS" in entities:
        redacted = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[REDACTED_EMAIL]", redacted)

    if "PHONE_NUMBER" in entities:
        redacted = re.sub(r"\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}\b", "[REDACTED_PHONE]", redacted)

    if "CREDIT_CARD" in entities:
        redacted = re.sub(r"\b(?:\d[ -]*?){13,16}\b", "[REDACTED_CARD]", redacted)

    return redacted
