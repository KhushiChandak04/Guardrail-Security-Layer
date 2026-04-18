# import asyncio
# from dataclasses import dataclass
# from app.services.vector_service import VectorService
# from app.utils.security_utils import normalize_text
# from app.guardrails.input.regex_rules import detect_system_extraction, detect_heuristic_injection
# from app.guardrails.input.ml_ensemble import MLEnsembleDetector
# from app.guardrails.output.redaction import mask_sensitive

# @dataclass
# class InputVerdict:
#     blocked: bool
#     reason: str
#     risk_level: str
#     sanitized_prompt: str

# class GuardrailEngine:
#     def __init__(self, vector_service: VectorService):
#         self.vector_service = vector_service
#         self.ml_ensemble = MLEnsembleDetector()
#         self.risk_block_threshold = 70
#         self.risk_sanitize_threshold = 40

#     # async def check_vector_async(self, prompt: str) -> tuple[float, str | None]:
#     #     """Wrap the ChromaDB check to run asynchronously."""
#     #     return await asyncio.to_thread(self.vector_service.check_prompt, prompt)
#     async def check_vector_async(self, prompt: str) -> tuple[float, str | None]:
#         """Wrap the ChromaDB check to run asynchronously."""
#         # 1. Call the correct method name: query_similar
#         match = await asyncio.to_thread(self.vector_service.query_similar, prompt)
        
#         # 2. Extract the data from the VectorMatch object
#         if match:
#             # Your VectorService calculates score as (1.0 - distance). 
#             # We convert it back to distance so your engine's < 0.45 logic still works perfectly!
#             distance = 1.0 - match.score 
#             return distance, f"Matched vector: {match.pattern[:30]}..."
            
#         return 1.0, None  # Default safe distance if nothing is found
    

#     async def validate_input(self, prompt: str) -> InputVerdict:
#         normalized_data = normalize_text(prompt)
#         reasons = []
        
#         # 1. Instant Regex Checks (Zero latency, run synchronously first)
#         sys_ext = detect_system_extraction(normalized_data)
#         if sys_ext["triggered"]:
#             return InputVerdict(True, "System prompt extraction attempt", "high", "")
            
#         heuristics = detect_heuristic_injection(normalized_data)
        
#         # 2. Parallel Heavy Checks (Run ML Ensemble and ChromaDB at the same time)
#         ml_task = self.ml_ensemble.score_concurrently(prompt)
#         vector_task = self.check_vector_async(prompt)
        
#         (ml_score, ml_reason), (vector_distance, vector_error) = await asyncio.gather(ml_task, vector_task)

#         # Vector risk calculation
#         vector_risk = 0
#         if vector_distance and vector_distance < 0.45:
#             vector_risk = 80
#             reasons.append(f"Vector similarity match ({vector_distance:.2f})")

#         # Combine all risks
#         risk_score = max(heuristics["risk"], ml_score, vector_risk)
#         reasons.extend(heuristics["reasons"])
#         if ml_reason and ml_reason != "Safe":
#             reasons.append(ml_reason)

#         # 3. Decision
#         action = "allow"
#         if risk_score >= self.risk_block_threshold:
#             action = "block"
#         elif risk_score >= self.risk_sanitize_threshold:
#             action = "sanitize"

#         sanitized_prompt = prompt
#         if action == "sanitize":
#             sanitized_prompt, _ = mask_sensitive(prompt, use_presidio=True)

#         return InputVerdict(
#             blocked=(action == "block"),
#             reason=" | ".join(list(set(reasons))) if reasons else "Safe",
#             risk_level="high" if action == "block" else ("medium" if action == "sanitize" else "low"),
#             sanitized_prompt=sanitized_prompt
#         )
import asyncio
from dataclasses import dataclass
from app.services.vector_service import VectorService
from app.utils.security_utils import normalize_text
from app.guardrails.input.regex_rules import detect_system_extraction, detect_heuristic_injection
from app.guardrails.input.ml_ensemble import MLEnsembleDetector
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
        self.ml_ensemble = MLEnsembleDetector()
        self.risk_block_threshold = 70
        self.risk_sanitize_threshold = 40

    async def check_vector_async(self, prompt: str) -> tuple[float, str | None]:
        """Wrap the ChromaDB check to run asynchronously."""
        # 1. Call the correct method name: query_similar
        match = await asyncio.to_thread(self.vector_service.query_similar, prompt)
        
        # 2. Extract the data from the VectorMatch object
        if match:
            # Your VectorService calculates score as (1.0 - distance). 
            # We convert it back to distance so your engine's < 0.45 logic still works perfectly!
            distance = 1.0 - match.score 
            return distance, f"Matched vector: {match.pattern[:30]}..."
            
        return 1.0, None  # Default safe distance if nothing is found
    
    async def validate_input(self, prompt: str) -> InputVerdict:
        normalized_data = normalize_text(prompt)
        reasons = []
        
        # 1. Instant Regex Checks (Zero latency, run synchronously first)
        sys_ext = detect_system_extraction(normalized_data)
        if sys_ext["triggered"]:
            return InputVerdict(True, "System prompt extraction attempt", "high", "")
            
        heuristics = detect_heuristic_injection(normalized_data)
        
        # 2. Parallel Heavy Checks (Run ML Ensemble and ChromaDB at the same time)
        ml_task = self.ml_ensemble.score_concurrently(prompt)
        vector_task = self.check_vector_async(prompt)
        
        (ml_score, ml_reason), (vector_distance, vector_error) = await asyncio.gather(ml_task, vector_task)

        # Vector risk calculation
        vector_risk = 0
        if vector_distance and vector_distance < 0.45:
            vector_risk = 80
            reasons.append(f"Vector similarity match ({vector_distance:.2f})")

        # Combine all risks
        risk_score = max(heuristics["risk"], ml_score, vector_risk)
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
        """
        Scans the LLM output for PII or secrets before sending it to the user.
        """
        # Call the Presidio redaction logic we imported at the top of the file
        sanitized_text, redactions = mask_sensitive(text, use_presidio=True)
        
        # If we found and redacted PII, elevate the risk score
        output_risk = "high" if "system_disclosure" in redactions else ("medium" if redactions else "low")
        
        return sanitized_text, redactions, output_risk