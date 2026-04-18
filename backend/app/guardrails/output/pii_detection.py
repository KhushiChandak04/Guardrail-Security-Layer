import logging

from presidio_analyzer import AnalyzerEngine

from app.config.constants import PII_ENTITIES

logger = logging.getLogger(__name__)


class PIIDetector:
    def __init__(self) -> None:
        self.enabled = True
        try:
            self.analyzer = AnalyzerEngine()
        except Exception as error:
            logger.warning("Presidio Analyzer failed to initialize. PII checks disabled: %s", error)
            self.enabled = False

    def find_entities(self, text: str) -> set[str]:
        if not self.enabled or not text.strip():
            return set()

        results = self.analyzer.analyze(text=text, entities=PII_ENTITIES, language="en")
        return {result.entity_type for result in results}
