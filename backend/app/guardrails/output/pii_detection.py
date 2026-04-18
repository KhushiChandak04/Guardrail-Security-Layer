# import logging

# from presidio_analyzer import AnalyzerEngine

# from app.config.constants import PII_ENTITIES

# logger = logging.getLogger(__name__)


# class PIIDetector:
#     def __init__(self) -> None:
#         self.enabled = True
#         try:
#             self.analyzer = AnalyzerEngine()
#         except Exception as error:
#             logger.warning("Presidio Analyzer failed to initialize. PII checks disabled: %s", error)
#             self.enabled = False

#     def find_entities(self, text: str) -> set[str]:
#         if not self.enabled or not text.strip():
#             return set()

#         results = self.analyzer.analyze(text=text, entities=PII_ENTITIES, language="en")
#         return {result.entity_type for result in results}
import logging
import re

from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern

from app.config.constants import PII_ENTITIES

logger = logging.getLogger(__name__)


class PIIDetector:
    def __init__(self) -> None:
        self.enabled = True
        try:
            self.analyzer = AnalyzerEngine()
            self._add_custom_recognizers()
        except Exception as error:
            logger.warning("Presidio Analyzer failed to initialize. PII checks disabled: %s", error)
            self.enabled = False
            
    def _add_custom_recognizers(self):
        """Injects custom regex patterns into Presidio's registry."""
        
        # 1. PAN Card Recognizer
        pan_pattern = Pattern(
            name="pan_pattern", 
            regex=r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b", 
            score=0.85
        )
        pan_recognizer = PatternRecognizer(
            supported_entity="INDIA_PAN", 
            patterns=[pan_pattern]
        )
        
        # 2. Aadhaar Recognizer
        aadhaar_pattern = Pattern(
            name="aadhaar_pattern", 
            regex=r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b", 
            score=0.85
        )
        aadhaar_recognizer = PatternRecognizer(
            supported_entity="INDIA_AADHAAR", 
            patterns=[aadhaar_pattern]
        )
        
        # Add to registry
        self.analyzer.registry.add_recognizer(pan_recognizer)
        self.analyzer.registry.add_recognizer(aadhaar_recognizer)
        logger.info("Custom Indian PII recognizers (PAN, Aadhaar) loaded into Presidio.")

    def find_entities(self, text: str) -> set[str]:
        if not self.enabled or not text.strip():
            return set()

        # It will only look for the entities explicitly listed in PII_ENTITIES
        results = self.analyzer.analyze(text=text, entities=PII_ENTITIES, language="en")
        return {result.entity_type for result in results}