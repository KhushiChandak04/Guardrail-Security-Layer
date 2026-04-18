from app.core.decision_engine import InputDecision
from app.core.policy_engine import should_block
from app.core.risk_scoring import score_to_risk
from app.guardrails.input.prompt_injection import PromptInjectionDetector
from app.guardrails.input.toxicity import ToxicityDetector
from app.guardrails.output.hallucination import HallucinationChecker
from app.guardrails.output.pii_detection import PIIDetector
from app.guardrails.output.redaction import redact_text
from app.services.vector_service import VectorService


class GuardrailEngine:
    def __init__(self, *, vector_service: VectorService) -> None:
        self.prompt_injection = PromptInjectionDetector(vector_service=vector_service)
        self.toxicity = ToxicityDetector()
        self.pii_detector = PIIDetector()
        self.hallucination = HallucinationChecker()

    def validate_input(self, prompt: str) -> InputDecision:
        prompt_score, prompt_reason = self.prompt_injection.score(prompt)
        toxicity_score, toxicity_reason = self.toxicity.score(prompt)

        final_score = max(prompt_score, toxicity_score)
        risk_level = score_to_risk(final_score)
        blocked = should_block(risk_level)

        reason = "Prompt passed input validation"
        if prompt_score >= toxicity_score and prompt_reason:
            reason = prompt_reason
        elif toxicity_reason:
            reason = toxicity_reason

        return InputDecision(blocked=blocked, risk_level=risk_level, reason=reason)

    def validate_output(self, text: str) -> tuple[str, list[str], str]:
        entities = self.pii_detector.find_entities(text)
        redacted = redact_text(text, entities)

        hallucination_score = self.hallucination.score(redacted)
        base_score = 0.65 if entities else 0.1
        risk_level = score_to_risk(max(base_score, hallucination_score))

        return redacted, sorted(entities), risk_level
