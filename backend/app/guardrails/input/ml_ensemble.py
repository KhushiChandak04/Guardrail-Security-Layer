# import asyncio
# import logging

# from transformers import pipeline

# logger = logging.getLogger(__name__)


# class MLEnsembleDetector:
#     def __init__(
#         self,
#         *,
#         injection_model: str,
#         toxicity_model: str,
#         local_files_only: bool = False,
#         device: int = -1,
#     ):
#         self.injection_model = injection_model
#         self.toxicity_model = toxicity_model
#         self.local_files_only = local_files_only
#         self.device = device

#         logger.info(
#             "Loading ML ensemble models (local_only=%s): injection=%s toxicity=%s",
#             self.local_files_only,
#             self.injection_model,
#             self.toxicity_model,
#         )

#         self.injection_pipe = self._load_text_classifier(self.injection_model)
#         self.toxicity_pipe = self._load_text_classifier(self.toxicity_model)
#         logger.info("ML Ensemble loaded successfully.")

#     def _load_text_classifier(self, model_reference: str):
#         try:
#             return pipeline(
#                 "text-classification",
#                 model=model_reference,
#                 tokenizer=model_reference,
#                 local_files_only=self.local_files_only,
#                 device=self.device,
#             )
#         except Exception:
#             # Some local exports can be loaded with model-only reference.
#             return pipeline(
#                 "text-classification",
#                 model=model_reference,
#                 local_files_only=self.local_files_only,
#                 device=self.device,
#             )

#     def _run_injection(self, text: str) -> dict:
#         result = self.injection_pipe(text)[0]
#         # protectai outputs 'INJECTION' or 'SAFE'
#         risk = result["score"] * 100 if result["label"] == "INJECTION" else 0
#         return {"risk": risk, "reason": "Prompt Injection detected" if risk > 50 else None}

#     def _run_toxicity(self, text: str) -> dict:
#         result = self.toxicity_pipe(text)[0]
#         # unitary/toxic-bert outputs 'toxic' or 'safe' (and specific labels like 'obscene')
#         risk = result["score"] * 100 if result["label"] != "safe" else 0
#         return {"risk": risk, "reason": f"Toxic/Harmful intent ({result['label']})" if risk > 50 else None}

#     async def score_concurrently(self, text: str) -> tuple[float, str | None]:
#         """Runs both models in parallel and returns the highest risk."""
#         # Use to_thread to prevent heavy ML inference from blocking FastAPI's async event loop
#         inj_task = asyncio.to_thread(self._run_injection, text)
#         tox_task = asyncio.to_thread(self._run_toxicity, text)
        
#         inj_result, tox_result = await asyncio.gather(inj_task, tox_task)
        
#         # Determine which model triggered the highest risk
#         highest_risk = max(inj_result["risk"], tox_result["risk"])
        
#         reasons = []
#         if inj_result["reason"]: reasons.append(inj_result["reason"])
#         if tox_result["reason"]: reasons.append(tox_result["reason"])
        
#         combined_reason = " | ".join(reasons) if reasons else "Safe"
        
#         return highest_risk, combined_reason
import asyncio
import logging

from transformers import pipeline

logger = logging.getLogger(__name__)


class MLEnsembleDetector:
    def __init__(
        self,
        *,
        injection_model: str,
        secondary_injection_model: str,
        toxicity_model: str,
        local_files_only: bool = False,
        device: int = -1,
    ):
        self.injection_model = injection_model
        self.secondary_injection_model = secondary_injection_model
        self.toxicity_model = toxicity_model
        self.local_files_only = local_files_only
        self.device = device

        logger.info(
            (
                "Loading ML ensemble models (local_only=%s): "
                "primary_injection=%s secondary_injection=%s toxicity=%s"
            ),
            self.local_files_only,
            self.injection_model,
            self.secondary_injection_model,
            self.toxicity_model,
        )

        self.injection_pipe = self._load_text_classifier(self.injection_model)
        self.secondary_injection_pipe = self._load_text_classifier(self.secondary_injection_model)
        self.toxicity_pipe = self._load_text_classifier(self.toxicity_model)
        logger.info("ML Ensemble loaded successfully.")

    def _load_text_classifier(self, model_reference: str):
        try:
            return pipeline(
                "text-classification",
                model=model_reference,
                tokenizer=model_reference,
                local_files_only=self.local_files_only,
                device=self.device,
            )
        except Exception as error:
            raise RuntimeError(f"Failed to load required text-classification model: {model_reference}") from error

    def _normalize_label(self, label: str) -> str:
        return str(label or "").strip().lower().replace("_", " ").replace("-", " ")

    def _is_injection_safe_label(self, label: str) -> bool:
        normalized = self._normalize_label(label)
        return normalized in {
            "safe",
            "label 0",
            "normal",
            "benign",
            "not injection",
            "no injection",
        }

    def _is_toxicity_safe_label(self, label: str) -> bool:
        normalized = self._normalize_label(label)
        return normalized in {
            "safe",
            "label 0",
            "non toxic",
            "not toxic",
            "neutral",
            "benign",
            "clean",
        }

    def _run_injection(self, text: str, *, classifier, model_label: str) -> dict:
        result = classifier(text)[0]
        label = str(result.get("label", ""))
        score = float(result.get("score", 0.0))

        # xTRam1 commonly uses LABEL_0/LABEL_1 and ProtectAI uses SAFE/INJECTION.
        is_safe = self._is_injection_safe_label(label)

        risk = score * 100 if not is_safe else 0
        return {
            "risk": risk,
            "reason": f"Prompt Injection detected ({model_label})" if risk > 50 else None,
        }

    def _run_toxicity(self, text: str) -> dict:
        result = self.toxicity_pipe(text)[0]
        label = str(result.get("label", ""))
        score = float(result.get("score", 0.0))

        # Different toxicity models emit different safe labels (safe, non-toxic, label_0, etc).
        is_safe = self._is_toxicity_safe_label(label)
        risk = score * 100 if not is_safe else 0
        return {"risk": risk, "reason": f"Toxic/Harmful intent ({label})" if risk > 50 else None}

    # async def score_concurrently(self, text: str) -> tuple[float, str | None]:
    #     """Runs both models in parallel and returns the highest risk."""
    #     # Use to_thread to prevent heavy ML inference from blocking FastAPI's async event loop
    #     inj_task = asyncio.to_thread(self._run_injection, text)
    #     tox_task = asyncio.to_thread(self._run_toxicity, text)
    async def score_concurrently(self, text: str) -> tuple[float, str | None]:
        # Truncate text to roughly fit within the 512 token limit 
        # (1500 chars is a safe approximation for English)
        safe_text = text[:1500] 

        # Run all ML classifiers together so every prompt is evaluated by each model.
        inj_primary_task = asyncio.to_thread(
            self._run_injection,
            safe_text,
            classifier=self.injection_pipe,
            model_label="primary",
        )
        inj_secondary_task = asyncio.to_thread(
            self._run_injection,
            safe_text,
            classifier=self.secondary_injection_pipe,
            model_label="secondary",
        )
        tox_task = asyncio.to_thread(self._run_toxicity, safe_text)

        inj_primary_result, inj_secondary_result, tox_result = await asyncio.gather(
            inj_primary_task,
            inj_secondary_task,
            tox_task,
        )

        # Determine which model triggered the highest risk
        highest_risk = max(
            inj_primary_result["risk"],
            inj_secondary_result["risk"],
            tox_result["risk"],
        )

        reasons = []
        if inj_primary_result["reason"]:
            reasons.append(inj_primary_result["reason"])
        if inj_secondary_result["reason"]:
            reasons.append(inj_secondary_result["reason"])
        if tox_result["reason"]:
            reasons.append(tox_result["reason"])

        combined_reason = " | ".join(reasons) if reasons else "Safe"

        return highest_risk, combined_reason