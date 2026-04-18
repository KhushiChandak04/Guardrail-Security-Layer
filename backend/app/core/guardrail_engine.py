# # # # from app.core.decision_engine import InputDecision
# # # # from app.core.policy_engine import should_block
# # # # from app.core.risk_scoring import score_to_risk
# # # # from app.guardrails.input.prompt_injection import PromptInjectionDetector
# # # # from app.guardrails.input.toxicity import ToxicityDetector
# # # # from app.guardrails.output.hallucination import HallucinationChecker
# # # # from app.guardrails.output.pii_detection import PIIDetector
# # # # from app.guardrails.output.redaction import redact_text
# # # # from app.services.vector_service import VectorService


# # # # class GuardrailEngine:
# # # #     def __init__(self, *, vector_service: VectorService) -> None:
# # # #         self.prompt_injection = PromptInjectionDetector(vector_service=vector_service)
# # # #         self.toxicity = ToxicityDetector()
# # # #         self.pii_detector = PIIDetector()
# # # #         self.hallucination = HallucinationChecker()

# # # #     def validate_input(self, prompt: str) -> InputDecision:
# # # #         prompt_score, prompt_reason = self.prompt_injection.score(prompt)
# # # #         toxicity_score, toxicity_reason = self.toxicity.score(prompt)

# # # #         final_score = max(prompt_score, toxicity_score)
# # # #         risk_level = score_to_risk(final_score)
# # # #         blocked = should_block(risk_level)

# # # #         reason = "Prompt passed input validation"
# # # #         if prompt_score >= toxicity_score and prompt_reason:
# # # #             reason = prompt_reason
# # # #         elif toxicity_reason:
# # # #             reason = toxicity_reason

# # # #         return InputDecision(blocked=blocked, risk_level=risk_level, reason=reason)

# # # #     def validate_output(self, text: str) -> tuple[str, list[str], str]:
# # # #         entities = self.pii_detector.find_entities(text)
# # # #         redacted = redact_text(text, entities)

# # # #         hallucination_score = self.hallucination.score(redacted)
# # # #         base_score = 0.65 if entities else 0.1
# # # #         risk_level = score_to_risk(max(base_score, hallucination_score))

# # # #         return redacted, sorted(entities), risk_level
# # # from app.guardrails.input.regex_rules import detect_secrets_and_pii
# # # from app.services.vector_service import vector_db
# # # # Import ML classifiers here as well (e.g., DeBERTa from prompt_injection.py)

# # # class GuardrailEngine:
# # #     def __init__(self):
# # #         self.risk_threshold = 60

# # #     def evaluate_ingress(self, user_prompt: str) -> dict:
# # #         """Runs the prompt through all input defense layers."""
        
# # #         # 1. Hard fail on sensitive data leaks
# # #         data_leak_reasons = detect_secrets_and_pii(user_prompt)
# # #         if data_leak_reasons:
# # #             return {
# # #                 "is_safe": False,
# # #                 "risk_score": 100,
# # #                 "reasons": data_leak_reasons
# # #             }

# # #         # 2. Vector Semantic Search
# # #         distance = vector_db.check_similarity(user_prompt)
# # #         vector_risk = 0
# # #         reasons = []
        
# # #         if distance < 0.6:
# # #             vector_risk = 80
# # #             reasons.append(f"High semantic similarity to known jailbreak (distance={distance:.2f})")
            
# # #         # 3. Combine scores (you would integrate ML rules here too)
# # #         total_risk = vector_risk # + ml_risk_score
        
# # #         return {
# # #             "is_safe": total_risk < self.risk_threshold,
# # #             "risk_score": int(total_risk),
# # #             "reasons": reasons
# # #         }

# # # guardrail_engine = GuardrailEngine()
# # from dataclasses import dataclass
# # from app.services.vector_service import VectorService
# # from app.guardrails.input.regex_rules import detect_secrets_and_pii

# # # Assuming these functions from our sandbox were moved to their respective files:
# # from app.guardrails.input.prompt_injection import detect_prompt_injection 
# # from app.guardrails.output.redaction import mask_sensitive
# # from app.guardrails.output.hallucination import detect_unsafe_output

# # @dataclass
# # class InputVerdict:
# #     blocked: bool
# #     reason: str
# #     risk_level: str

# # class GuardrailEngine:
# #     def __init__(self, vector_service: VectorService):
# #         self.vector_service = vector_service
# #         self.risk_threshold = 60

# #     def validate_input(self, prompt: str) -> InputVerdict:
# #         """Evaluates the prompt before it hits the LLM."""
        
# #         # 1. Hard fail on sensitive data leaks (PII/Secrets)
# #         leak_reasons = detect_secrets_and_pii(prompt)
# #         if leak_reasons:
# #             return InputVerdict(
# #                 blocked=True, 
# #                 reason=" | ".join(leak_reasons), 
# #                 risk_level="high"
# #             )

# #         # 2. Check Prompt Injection (Heuristic Rules)
# #         rule_result = detect_prompt_injection(prompt)
# #         risk_score = rule_result["risk"]
# #         reasons = rule_result["reasons"]

# #         # 3. Vector Semantic Search (ChromaDB)
# #         distance = self.vector_service.check_similarity(prompt)
# #         vector_risk = 0
# #         if distance < 0.6:
# #             vector_risk = 25
# #         elif distance < 0.8:
# #             vector_risk = 15

# #         if vector_risk > 0:
# #             reasons.append(f"Semantic similarity to known attack (distance={distance:.2f})")

# #         # 4. Calculate Final Risk
# #         total_risk = min(100, risk_score + vector_risk)
# #         blocked = total_risk >= self.risk_threshold
        
# #         # Categorize risk for the dashboard
# #         risk_level = "high" if blocked else ("medium" if total_risk > 30 else "low")
# #         reason_str = " | ".join(reasons) if reasons else "Safe"

# #         return InputVerdict(
# #             blocked=blocked, 
# #             reason=reason_str, 
# #             risk_level=risk_level
# #         )

# #     def validate_output(self, text: str) -> tuple[str, list, str]:
# #         """Evaluates the LLM's response before sending it to the user."""
        
# #         # 1. Check if the LLM hallucinated or leaked system instructions
# #         unsafe, leak_reason = detect_unsafe_output(text)
# #         if unsafe:
# #             return ("Error: Safe output could not be generated.", [leak_reason], "high")

# #         # 2. Redact any PII the LLM might have generated
# #         # Assuming mask_sensitive returns a tuple: (redacted_text, list_of_redaction_labels)
# #         redacted_text, redactions = mask_sensitive(text)
        
# #         output_risk = "medium" if redactions else "low"
        
# #         return (redacted_text, redactions, output_risk)

# from app.core.decision_engine import InputDecision
# from app.core.policy_engine import should_block
# from app.core.risk_scoring import score_to_risk
# from app.guardrails.input.prompt_injection import PromptInjectionDetector
# from app.guardrails.input.regex_rules import detect_secrets_and_pii
# from app.guardrails.output.hallucination import HallucinationChecker
# from app.guardrails.output.redaction import mask_sensitive
# from app.services.vector_service import VectorService

# class GuardrailEngine:
#     def __init__(self, *, vector_service: VectorService) -> None:
#         self.vector_service = vector_service
#         self.prompt_injection = PromptInjectionDetector(vector_service=vector_service)
#         self.hallucination = HallucinationChecker()

#     def validate_input(self, prompt: str) -> InputDecision:
#         # 1. Hard fail on PII and Secrets on Ingress
#         leak_reasons = detect_secrets_and_pii(prompt)
#         if leak_reasons:
#             return InputDecision(blocked=True, risk_level="high", reason=" | ".join(leak_reasons))

#         # 2. Check for Malicious Injection (ML & Vector)
#         prompt_score, prompt_reason = self.prompt_injection.score(prompt)
        
#         risk_level = score_to_risk(prompt_score)
#         blocked = should_block(risk_level)

#         return InputDecision(
#             blocked=blocked, 
#             risk_level=risk_level, 
#             reason=prompt_reason or "Safe"
#         )

#     def validate_output(self, text: str) -> tuple[str, list[str], str]:
#         # 1. Check Hallucination / Unsafe Output
#         hallucination_score = self.hallucination.score(text)
#         if hallucination_score > 0.7:
#              return ("Error: Output deemed unsafe or hallucinated.", ["hallucination_detected"], "high")

#         # 2. Redact any accidental PII from the LLM
#         redacted_text, redactions = mask_sensitive(text)
        
#         output_risk = "medium" if redactions else "low"
        
#         return redacted_text, redactions, output_risk
from dataclasses import dataclass
from app.services.vector_service import VectorService
from app.utils.security_utils import normalize_text
from app.guardrails.input.regex_rules import detect_system_extraction, detect_heuristic_injection
from app.guardrails.input.prompt_injection import PromptInjectionDetector
from app.guardrails.output.redaction import mask_sensitive

@dataclass
class InputVerdict:
    blocked: bool
    reason: str
    risk_level: str
    sanitized_prompt: str

class GuardrailEngine:
    def __init__(self, vector_service: VectorService):
        self.vector_service = vector_service
        self.ml_detector = PromptInjectionDetector(vector_service=vector_service)
        self.risk_block_threshold = 70
        self.risk_sanitize_threshold = 40

    def validate_input(self, prompt: str) -> InputVerdict:
        normalized_data = normalize_text(prompt)
        reasons = []
        risk_score = 0

        # 1. System Extraction (Immediate Block)
        sys_ext = detect_system_extraction(normalized_data)
        if sys_ext["triggered"]:
            return InputVerdict(True, "System prompt extraction attempt", "high", "")

        # 2. Heuristics & ML
        heuristics = detect_heuristic_injection(normalized_data)
        ml_score, ml_reason = self.ml_detector.score(prompt) # Contains Vector & DeBERTa logic
        
        risk_score = max(heuristics["risk"], ml_score * 100)
        reasons.extend(heuristics["reasons"])
        if ml_reason and ml_reason != "Safe":
            reasons.append(ml_reason)

        # 3. Decision
        action = "allow"
        if risk_score >= self.risk_block_threshold:
            action = "block"
        elif risk_score >= self.risk_sanitize_threshold:
            action = "sanitize"

        sanitized_prompt = prompt
        if action == "sanitize":
            sanitized_prompt, _ = mask_sensitive(prompt, use_presidio=True)

        return InputVerdict(
            blocked=(action == "block"),
            reason=" | ".join(list(set(reasons))) if reasons else "Safe",
            risk_level="high" if action == "block" else ("medium" if action == "sanitize" else "low"),
            sanitized_prompt=sanitized_prompt
        )

    def validate_output(self, text: str) -> tuple[str, list[str], str]:
        lowered = text.lower()
        if "system prompt" in lowered or "internal instructions" in lowered:
            return ("Error: Output deemed unsafe.", ["system_disclosure"], "high")

        redacted_text, redactions = mask_sensitive(text, use_presidio=True)
        output_risk = "medium" if redactions else "low"
        
        return (redacted_text, redactions, output_risk)