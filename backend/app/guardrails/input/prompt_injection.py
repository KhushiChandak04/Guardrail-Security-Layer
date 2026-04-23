# from app.config.settings import settings
# from app.guardrails.input.regex_rules import COMPILED_INPUT_PATTERNS
# from app.services.vector_service import VectorService


# class PromptInjectionDetector:
#     def __init__(self, *, vector_service: VectorService) -> None:
#         self.vector_service = vector_service

#     def score(self, prompt: str) -> tuple[float, str]:
#         for compiled, label in COMPILED_INPUT_PATTERNS:
#             if compiled.search(prompt):
#                 return 0.95, f"Rule-based prompt injection hit: {label}"

#         vector_match = self.vector_service.query_similar(prompt)
#         if vector_match and vector_match.score >= settings.jailbreak_similarity_threshold:
#             return 0.9, "Vector similarity matched known jailbreak pattern"

#         if vector_match:
#             return max(0.2, vector_match.score * 0.6), "No blocking pattern found"

#         return 0.1, "No prompt injection pattern found"

import logging

from transformers import pipeline

from app.config.settings import settings
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


class PromptInjectionDetector:
    def __init__(self, *, vector_service: VectorService, model_name: str = "protectai/deberta-v3-base-prompt-injection") -> None:
        self.vector_service = vector_service
        self.model_name = model_name
        self.classifier = None

    def _get_classifier(self):
        if self.classifier is not None:
            return self.classifier

        try:
            logger.info("Loading prompt injection model: %s", self.model_name)
            self.classifier = pipeline(
                "text-classification",
                model=self.model_name,
                truncation=True,
                max_length=512,
            )
        except Exception as error:
            raise RuntimeError(f"Failed to load required prompt injection model: {self.model_name}") from error

        return self.classifier

    def score(self, prompt: str) -> tuple[float, str]:
        ml_score = 0.0
        reasons: list[str] = []

        classifier = self._get_classifier()
        ml_result = classifier(prompt)[0]
        ml_confidence = float(ml_result["score"])
        if ml_result["label"].upper() == "INJECTION" and ml_confidence >= 0.98:
            ml_score = 0.95
            reasons.append(f"ML classifier detected prompt injection (confidence={ml_confidence:.2f})")
        elif ml_result["label"].upper() == "INJECTION" and ml_confidence >= 0.85:
            ml_score = 0.60
            reasons.append(f"ML classifier flagged suspicious prompt (confidence={ml_confidence:.2f})")

        vector_match = self.vector_service.query_similar(prompt)
        vector_score = 0.0
        if vector_match and vector_match.score >= settings.jailbreak_similarity_threshold:
            vector_score = 0.90
            reasons.append(f"Semantic similarity matched known jailbreak (score={vector_match.score:.2f})")
        elif vector_match:
            vector_score = max(0.2, vector_match.score * 0.6)

        final_score = max(ml_score, vector_score, 0.1)

        if not reasons:
            return final_score, "Safe"

        return final_score, " | ".join(reasons)