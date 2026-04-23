import logging
import re

from presidio_analyzer import AnalyzerEngine, Pattern, PatternRecognizer
from presidio_anonymizer import AnonymizerEngine

from app.config.constants import PII_ENTITIES

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
PHONE_CANDIDATE_REGEX = re.compile(r"(?:\+?\(?\d[\d\s().-]{7,}\d)")
US_SSN_REGEX = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
CREDIT_CARD_CANDIDATE_REGEX = re.compile(r"\b(?:\d[ -]?){13,19}\b")
INDIA_PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
INDIA_AADHAAR_REGEX = re.compile(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b")

PASSPORT_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:passport(?:\s+number)?|passport\s+no\.?)\s*(?:is|number|no\.?)?\s*[:#-]?\s*)([A-Z0-9]{7,12})\b"
)
DRIVER_LICENSE_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:driver'?s?\s+licen[cs]e|driving\s+licen[cs]e|license)\s*(?:number|no\.?|is)?\s*[:#-]?\s*)([A-Z]\d{6,10})\b"
)
BANK_ACCOUNT_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:bank\s+account|account(?:\s+number)?|acct(?:\s+number)?)\s*[:#-]?\s*)(\d{8,18})\b"
)
ROUTING_NUMBER_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:routing(?:\s+number)?)\s*[:#-]?\s*)(\d{9})\b"
)
DOB_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:dob|date\s+of\s+birth)\s*[:#-]?\s*)(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b"
)
PATIENT_ID_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:patient\s+id|member\s+id|mrn|policy(?:\s+id|\s+number)?|claim\s+id|school\s+id)\s*[:#-]?\s*)([A-Z0-9\-]{4,})\b"
)
PASSWORD_CONTEXT_REGEX = re.compile(
    r"(?i)\b((?:temporary\s+password|password|passwd|pwd)\s*(?::|=|\bis\b)\s*)([^\s,;]+)"
)
API_KEY_REGEX = re.compile(r"\bsk-(?:test|live)-[A-Za-z0-9]{8,}\b")
GITHUB_TOKEN_REGEX = re.compile(r"\bghp_[A-Za-z0-9]{16,}\b")


def _ordered_unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for value in values:
        clean = str(value or "").strip()
        if not clean:
            continue
        if clean in seen:
            continue
        seen.add(clean)
        ordered.append(clean)

    return ordered


def _passes_luhn(number: str) -> bool:
    digits = [int(char) for char in number if char.isdigit()]
    if len(digits) < 13:
        return False

    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        value = digit
        if index % 2 == parity:
            value *= 2
            if value > 9:
                value -= 9
        checksum += value

    return checksum % 10 == 0


def _apply_simple_sub(
    text: str,
    *,
    pattern: re.Pattern[str],
    placeholder: str,
    label: str,
    redactions: list[str],
) -> str:
    if not pattern.search(text):
        return text

    redactions.append(label)
    return pattern.sub(placeholder, text)


def _apply_context_sub(
    text: str,
    *,
    pattern: re.Pattern[str],
    placeholder: str,
    label: str,
    redactions: list[str],
) -> str:
    if not pattern.search(text):
        return text

    redactions.append(label)
    return pattern.sub(lambda match: f"{match.group(1)}{placeholder}", text)

try:
    analyzer = AnalyzerEngine()

    # Add custom Indian IDs for better localization coverage.
    pan_pattern = Pattern(name="pan_pattern", regex=r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", score=0.85)
    pan_recognizer = PatternRecognizer(supported_entity="INDIA_PAN", patterns=[pan_pattern])

    aadhaar_pattern = Pattern(name="aadhaar_pattern", regex=r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b", score=0.85)
    aadhaar_recognizer = PatternRecognizer(supported_entity="INDIA_AADHAAR", patterns=[aadhaar_pattern])

    analyzer.registry.add_recognizer(pan_recognizer)
    analyzer.registry.add_recognizer(aadhaar_recognizer)

    anonymizer = AnonymizerEngine()
except Exception as exc:
    logger.warning(f"Presidio failed to initialize: {exc}")
    analyzer, anonymizer = None, None


def mask_sensitive(text: str, use_presidio: bool = True) -> tuple[str, list[str]]:
    redactions: list[str] = []
    masked = str(text or "")

    if not masked:
        return "", []

    # Fast regex pass keeps fallback redaction usable when Presidio is unavailable.
    if EMAIL_REGEX.search(masked):
        redactions.append("EMAIL_ADDRESS")
    masked = EMAIL_REGEX.sub("<EMAIL_ADDRESS>", masked)

    def phone_replacer(match):
        candidate = match.group(0)
        digits = re.sub(r"\D", "", candidate)
        left_window = masked[max(0, match.start() - 24): match.start()].lower()
        if any(term in left_window for term in ("account", "routing", "aadhaar", "aadhar", "ssn", "policy", "member id", "claim id")):
            return candidate
        if 10 <= len(digits) <= 15:
            redactions.append("PHONE_NUMBER")
            return "<PHONE_NUMBER>"
        return candidate

    def card_replacer(match):
        value = match.group(0)
        digits = re.sub(r"\D", "", value)
        if 13 <= len(digits) <= 19 and _passes_luhn(digits):
            redactions.append("CREDIT_CARD")
            return "<CREDIT_CARD>"
        return value

    masked = CREDIT_CARD_CANDIDATE_REGEX.sub(card_replacer, masked)
    masked = _apply_simple_sub(
        masked,
        pattern=US_SSN_REGEX,
        placeholder="<US_SSN>",
        label="US_SSN",
        redactions=redactions,
    )
    masked = _apply_simple_sub(
        masked,
        pattern=INDIA_PAN_REGEX,
        placeholder="<INDIA_PAN>",
        label="INDIA_PAN",
        redactions=redactions,
    )
    masked = _apply_simple_sub(
        masked,
        pattern=INDIA_AADHAAR_REGEX,
        placeholder="<INDIA_AADHAAR>",
        label="INDIA_AADHAAR",
        redactions=redactions,
    )
    masked = _apply_simple_sub(
        masked,
        pattern=API_KEY_REGEX,
        placeholder="<API_KEY>",
        label="API_KEY",
        redactions=redactions,
    )
    masked = _apply_simple_sub(
        masked,
        pattern=GITHUB_TOKEN_REGEX,
        placeholder="<GITHUB_TOKEN>",
        label="GITHUB_TOKEN",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=PASSPORT_CONTEXT_REGEX,
        placeholder="<PASSPORT_NUMBER>",
        label="PASSPORT_NUMBER",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=DRIVER_LICENSE_CONTEXT_REGEX,
        placeholder="<DRIVER_LICENSE>",
        label="DRIVER_LICENSE",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=BANK_ACCOUNT_CONTEXT_REGEX,
        placeholder="<BANK_ACCOUNT>",
        label="BANK_ACCOUNT",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=ROUTING_NUMBER_CONTEXT_REGEX,
        placeholder="<ROUTING_NUMBER>",
        label="ROUTING_NUMBER",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=DOB_CONTEXT_REGEX,
        placeholder="<DATE_OF_BIRTH>",
        label="DATE_OF_BIRTH",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=PATIENT_ID_CONTEXT_REGEX,
        placeholder="<IDENTIFIER>",
        label="SENSITIVE_IDENTIFIER",
        redactions=redactions,
    )
    masked = _apply_context_sub(
        masked,
        pattern=PASSWORD_CONTEXT_REGEX,
        placeholder="<PASSWORD>",
        label="PASSWORD",
        redactions=redactions,
    )
    masked = PHONE_CANDIDATE_REGEX.sub(phone_replacer, masked)

    # Presidio pass provides higher-precision entity detection when available.
    if not use_presidio or not analyzer or not anonymizer:
        return masked, _ordered_unique(redactions)

    results = analyzer.analyze(text=masked, language="en", entities=PII_ENTITIES)
    if not results:
        return masked, _ordered_unique(redactions)

    anonymized = anonymizer.anonymize(text=masked, analyzer_results=results)
    presidio_labels = [r.entity_type for r in results if getattr(r, "entity_type", None)]

    return anonymized.text, _ordered_unique(redactions + presidio_labels)