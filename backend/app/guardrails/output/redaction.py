# # # import re


# # # def redact_text(text: str, entities: set[str]) -> str:
# # #     redacted = text

# # #     if "US_SSN" in entities:
# # #         redacted = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_US_SSN]", redacted)

# # #     if "EMAIL_ADDRESS" in entities:
# # #         redacted = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[REDACTED_EMAIL]", redacted)

# # #     if "PHONE_NUMBER" in entities:
# # #         redacted = re.sub(r"\b(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}\b", "[REDACTED_PHONE]", redacted)

# # #     if "CREDIT_CARD" in entities:
# # #         redacted = re.sub(r"\b(?:\d[ -]*?){13,16}\b", "[REDACTED_CARD]", redacted)

# # #     return redacted
# # from presidio_analyzer import AnalyzerEngine
# # from presidio_anonymizer import AnonymizerEngine

# # try:
# #     analyzer = AnalyzerEngine()
# #     anonymizer = AnonymizerEngine()
# # except Exception as exc:
# #     print(f"Warning: Presidio failed to initialize: {exc}")
# #     analyzer = None
# #     anonymizer = None

# # def mask_sensitive(text: str) -> tuple[str, list[str]]:
# #     """Returns the redacted text and a list of identified entity types."""
# #     if not analyzer or not anonymizer:
# #         return text, []
    
# #     results = analyzer.analyze(text=text, language='en')
# #     if not results:
# #         return text, []
    
# #     anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
# #     redaction_labels = list(set([result.entity_type for result in results]))
    
# #     return anonymized.text, redaction_labels
# from presidio_analyzer import AnalyzerEngine
# from presidio_anonymizer import AnonymizerEngine

# try:
#     analyzer = AnalyzerEngine()
#     anonymizer = AnonymizerEngine()
# except Exception as exc:
#     print(f"Warning: Presidio failed to initialize: {exc}")
#     analyzer = None
#     anonymizer = None

# # 1. Define the strict list of entities we actually want to block
# TARGET_ENTITIES = [
#     "PERSON", 
#     "PHONE_NUMBER", 
#     "EMAIL_ADDRESS", 
#     "CREDIT_CARD", 
#     "US_SSN",
#     "IBAN_CODE"
# ]

# def mask_sensitive(text: str) -> tuple[str, list[str]]:
#     """Returns the redacted text and a list of identified entity types."""
#     if not analyzer or not anonymizer:
#         return text, []
    
#     # 2. Pass the TARGET_ENTITIES list into the analyzer
#     results = analyzer.analyze(
#         text=text, 
#         language='en', 
#         entities=TARGET_ENTITIES
#     )
    
#     if not results:
#         return text, []
    
#     anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
#     redaction_labels = list(set([result.entity_type for result in results]))
    
#     return anonymized.text, redaction_labels

import re
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
import logging

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"\b[a-zA-Z0-9._%+-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
PHONE_CANDIDATE_REGEX = re.compile(r"(?:\+?\(?\d[\d\s().-]{7,}\d)")
TARGET_ENTITIES = ["PERSON", "PHONE_NUMBER", "EMAIL_ADDRESS", "CREDIT_CARD", "US_SSN"]

try:
    analyzer = AnalyzerEngine()
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

    # 2. Presidio Pass (Restricted to TARGET_ENTITIES)
    if not use_presidio or not analyzer or not anonymizer:
        return masked, list(set(redactions))

    results = analyzer.analyze(text=masked, language="en", entities=TARGET_ENTITIES)
    if not results:
        return masked, list(set(redactions))

    anonymized = anonymizer.anonymize(text=masked, analyzer_results=results)
    presidio_labels = [r.entity_type for r in results]
    
    return anonymized.text, list(set(redactions + presidio_labels))