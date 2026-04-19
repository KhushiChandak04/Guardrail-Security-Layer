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
import re
from dataclasses import dataclass

from app.config.settings import settings
from app.services.vector_service import VectorService
from app.utils.security_utils import normalize_text
from app.guardrails.input.regex_rules import detect_system_extraction, detect_heuristic_injection
from app.guardrails.input.ml_ensemble import MLEnsembleDetector
from app.guardrails.output.redaction import mask_sensitive
from app.guardrails.validators.document_validator import sanitize_document_text, scan_document

@dataclass
class InputVerdict:
    blocked: bool
    reason: str
    risk_level: str
    risk_score: float
    sanitized_prompt: str


@dataclass
class DocumentVerdict:
    blocked: bool
    reason: str
    risk_level: str
    risk_score: float
    sanitized_text: str


# Catch direct harmful-instruction requests that can be missed by toxicity classifiers.
HARMFUL_INSTRUCTION_PATTERNS = [
    re.compile(
        r"\b(how\s+to|steps?\s+to|guide\s+to|instructions?\s+to|recipe\s+for)\b.{0,80}\b(make|build|create|assemble|prepare|synthesize|construct)\b.{0,80}\b(bomb|explosive|ied|molotov|pipe\s*bomb|poison|weapon|napalm|malware|phishing)\b"
    ),
    re.compile(r"\b(make|build|create|assemble|prepare|synthesize|construct)\b.{0,40}\b(bomb|explosive|ied|molotov|pipe\s*bomb|poison|weapon|napalm|malware|phishing)\b"),
]

INSTRUCTION_HINT_TERMS = (
    "how to",
    "steps",
    "guide",
    "instructions",
    "recipe",
)

ACTION_HINT_TERMS = (
    "make",
    "build",
    "create",
    "assemble",
    "prepare",
    "synthesize",
    "construct",
)

DANGEROUS_HINT_TERMS = (
    "bomb",
    "explosive",
    "ied",
    "molotov",
    "pipe bomb",
    "poison",
    "weapon",
    "napalm",
    "malware",
    "phishing",
)


def _dedupe_reasons(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []

    for value in values:
        clean = str(value or "").strip()
        if not clean:
            continue

        key = clean.lower()
        if key in seen:
            continue

        seen.add(key)
        ordered.append(clean)

    return ordered

class GuardrailEngine:
    def __init__(self, vector_service: VectorService):
        self.vector_service = vector_service
        self.ml_ensemble = MLEnsembleDetector(
            injection_model=settings.prompt_injection_model_ref,
            toxicity_model=settings.toxicity_model_ref,
            local_files_only=settings.models_local_only,
        )
        self.risk_block_threshold = settings.ingress_block_threshold
        self.risk_sanitize_threshold = settings.ingress_sanitize_threshold

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

    def _detect_harmful_instruction(self, normalized_data: dict) -> tuple[int, str | None]:
        normalized = str(normalized_data.get("normalized", ""))
        compact = str(normalized_data.get("compact", ""))

        for pattern in HARMFUL_INSTRUCTION_PATTERNS:
            if pattern.search(normalized):
                return 95, "Prompt blocked"

        has_instruction_hint = any(term in normalized for term in INSTRUCTION_HINT_TERMS)
        has_action_hint = any(term in normalized for term in ACTION_HINT_TERMS)
        has_dangerous_hint = any(term in normalized for term in DANGEROUS_HINT_TERMS)

        # Compact fallback catches minor obfuscation like "howtomakeabomb".
        compact_bomb_request = "howtomakeabomb" in compact or "makabomb" in compact

        if (has_dangerous_hint and (has_instruction_hint or has_action_hint)) or compact_bomb_request:
            return 90, "Prompt blocked"

        return 0, None

    def _resolve_block_reason(
        self,
        *,
        heuristics: dict,
        ml_reason: str | None,
        vector_risk: float,
        harmful_risk: int,
    ) -> str:
        heuristic_reasons = [str(reason).lower() for reason in heuristics.get("reasons", [])]
        ml_reason_lower = str(ml_reason or "").lower()

        if any("jailbreak" in reason for reason in heuristic_reasons) or vector_risk >= self.risk_block_threshold:
            return "Jailbreak detected"

        if harmful_risk >= self.risk_block_threshold:
            return "Prompt blocked"

        if "toxic" in ml_reason_lower or "harmful" in ml_reason_lower:
            return "Prompt blocked"

        if heuristics.get("risk", 0) >= self.risk_block_threshold:
            return "Prompt Injection detected"

        if "prompt injection" in ml_reason_lower:
            return "Prompt Injection detected"

        return "Prompt blocked"
    
    async def validate_input(self, prompt: str) -> InputVerdict:
        normalized_data = normalize_text(prompt)
        reasons = []
        
        # 1. Instant Regex Checks (Zero latency, run synchronously first)
        sys_ext = detect_system_extraction(normalized_data)
        if sys_ext["triggered"]:
            return InputVerdict(True, "Prompt Injection detected", "high", 95.0, "")
            
        heuristics = detect_heuristic_injection(normalized_data)
        harmful_risk, harmful_reason = self._detect_harmful_instruction(normalized_data)
        
        # 2. Parallel Heavy Checks (Run ML Ensemble and ChromaDB at the same time)
        ml_task = self.ml_ensemble.score_concurrently(prompt)
        vector_task = self.check_vector_async(prompt)
        
        (ml_score, ml_reason), (vector_distance, _vector_error) = await asyncio.gather(ml_task, vector_task)

        # Vector risk calculation
        vector_risk = 0
        if vector_distance is not None and vector_distance < 0.45:
            vector_risk = 80
            reasons.append(f"Vector similarity match ({vector_distance:.2f})")

        # Combine all risks
        risk_score = max(heuristics["risk"], ml_score, vector_risk, harmful_risk)
        risk_score = float(max(0.0, min(100.0, risk_score)))
        reasons.extend(heuristics["reasons"])
        if ml_reason and ml_reason != "Safe":
            reasons.append(ml_reason)
        if harmful_reason:
            reasons.append(harmful_reason)

        ordered_reasons = _dedupe_reasons(reasons)

        # 3. Decision
        action = "allow"
        if risk_score >= self.risk_block_threshold:
            action = "block"
        elif risk_score >= self.risk_sanitize_threshold:
            action = "sanitize"

        sanitized_prompt = prompt
        if action == "sanitize":
            sanitized_prompt, _ = mask_sensitive(prompt, use_presidio=True)

        if action == "block":
            final_reason = self._resolve_block_reason(
                heuristics=heuristics,
                ml_reason=ml_reason,
                vector_risk=vector_risk,
                harmful_risk=harmful_risk,
            )
        elif ordered_reasons:
            final_reason = " | ".join(ordered_reasons)
        else:
            final_reason = "Safe"

        return InputVerdict(
            blocked=(action == "block"),
            reason=final_reason,
            risk_level="high" if action == "block" else ("medium" if action == "sanitize" else "low"),
            risk_score=risk_score,
            sanitized_prompt=sanitized_prompt
        )

    def validate_document(self, document_text: str) -> DocumentVerdict:
        scan_result = scan_document(document_text or "")
        risk = str(scan_result.get("risk", "LOW")).upper()
        reason = str(scan_result.get("message", "Document scanned."))
        blocked = risk == "HIGH"
        sanitized = sanitize_document_text(document_text or "")
        risk_score = 90.0 if risk == "HIGH" else (55.0 if risk == "MEDIUM" else 10.0)

        return DocumentVerdict(
            blocked=blocked,
            reason=reason,
            risk_level=risk.lower(),
            risk_score=risk_score,
            sanitized_text=sanitized,
        )

    def build_llm_input(self, *, prompt: str, sanitized_document_text: str | None = None) -> str:
        if not sanitized_document_text:
            return prompt

        return (
            f"{prompt}\n\n"
            "Document Context (sanitized):\n"
            f"{sanitized_document_text}"
        )

    def validate_output(self, text: str) -> tuple[str, list[str], str, float]:
        """
        Scans the LLM output for PII or secrets before sending it to the user.
        """
        # Call the Presidio redaction logic we imported at the top of the file
        sanitized_text, redactions = mask_sensitive(text, use_presidio=True)
        
        # Assign output risk and score based on detected redactions.
        if "system_disclosure" in redactions:
            output_risk = "high"
            output_score = 95.0
        elif redactions:
            output_risk = "medium"
            output_score = min(80.0, 45.0 + (len(redactions) * 7.5))
        else:
            output_risk = "low"
            output_score = 8.0
        
        return sanitized_text, redactions, output_risk, output_score