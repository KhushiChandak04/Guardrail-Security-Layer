import re
import logging
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine

# 1. IMPORT FROM CONSTANTS INSTEAD OF HARDCODING
from app.config.constants import PII_ENTITIES

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
PHONE_CANDIDATE_REGEX = re.compile(r"(?:\+?\(?\d[\d\s().-]{7,}\d)")

try:
    analyzer = AnalyzerEngine()
    
    # 2. INJECT INDIAN PII INTO THE REDACTION ENGINE
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
    redactions = []
    
    # 1. Regex Passes
    if EMAIL_REGEX.search(text):
        redactions.append("EMAIL_ADDRESS")
    masked = EMAIL_REGEX.sub("<EMAIL_ADDRESS>", text)

    def phone_replacer(match):
        digits = re.sub(r"\D", "", match.group(0))
        if 10 <= len(digits) <= 15:
            redactions.append("PHONE_NUMBER")
            return "<PHONE_NUMBER>"
        return match.group(0)

    masked = PHONE_CANDIDATE_REGEX.sub(phone_replacer, masked)

    # 2. Presidio Pass 
    if not use_presidio or not analyzer or not anonymizer:
        return masked, list(set(redactions))

    # 3. USE PII_ENTITIES TO PREVENT THE <PERSON> HALLUCINATION
    results = analyzer.analyze(text=masked, language="en", entities=PII_ENTITIES)
    if not results:
        return masked, list(set(redactions))

    anonymized = anonymizer.anonymize(text=masked, analyzer_results=results)
    presidio_labels = [r.entity_type for r in results]
    
    return anonymized.text, list(set(redactions + presidio_labels))