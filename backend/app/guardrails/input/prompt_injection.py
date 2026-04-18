from app.config.settings import settings
from app.guardrails.input.regex_rules import COMPILED_INPUT_PATTERNS
from app.services.vector_service import VectorService


class PromptInjectionDetector:
    def __init__(self, *, vector_service: VectorService) -> None:
        self.vector_service = vector_service

    def score(self, prompt: str) -> tuple[float, str]:
        for compiled, label in COMPILED_INPUT_PATTERNS:
            if compiled.search(prompt):
                return 0.95, f"Rule-based prompt injection hit: {label}"

        vector_match = self.vector_service.query_similar(prompt)
        if vector_match and vector_match.score >= settings.jailbreak_similarity_threshold:
            return 0.9, "Vector similarity matched known jailbreak pattern"

        if vector_match:
            return max(0.2, vector_match.score * 0.6), "No blocking pattern found"

        return 0.1, "No prompt injection pattern found"
