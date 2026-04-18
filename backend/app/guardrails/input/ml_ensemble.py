import asyncio
from transformers import pipeline
import logging

logger = logging.getLogger(__name__)

class MLEnsembleDetector:
    def __init__(self):
        logger.info("Loading ML Ensemble (DeBERTa + Toxic-BERT)...")
        # 1. The Jailbreak/Injection Model
        self.injection_pipe = pipeline(
            "text-classification",
            model="protectai/deberta-v3-base-prompt-injection",
            device=-1  # Use 0 if you have a local Nvidia GPU available
        )
        
        # 2. The Harm/Toxicity Model
        self.toxicity_pipe = pipeline(
            "text-classification",
            model="unitary/toxic-bert",
            device=-1
        )
        logger.info("ML Ensemble loaded successfully.")

    def _run_injection(self, text: str) -> dict:
        result = self.injection_pipe(text)[0]
        # protectai outputs 'INJECTION' or 'SAFE'
        risk = result["score"] * 100 if result["label"] == "INJECTION" else 0
        return {"risk": risk, "reason": "Prompt Injection detected" if risk > 50 else None}

    def _run_toxicity(self, text: str) -> dict:
        result = self.toxicity_pipe(text)[0]
        # unitary/toxic-bert outputs 'toxic' or 'safe' (and specific labels like 'obscene')
        risk = result["score"] * 100 if result["label"] != "safe" else 0
        return {"risk": risk, "reason": f"Toxic/Harmful intent ({result['label']})" if risk > 50 else None}

    async def score_concurrently(self, text: str) -> tuple[float, str | None]:
        """Runs both models in parallel and returns the highest risk."""
        # Use to_thread to prevent heavy ML inference from blocking FastAPI's async event loop
        inj_task = asyncio.to_thread(self._run_injection, text)
        tox_task = asyncio.to_thread(self._run_toxicity, text)
        
        inj_result, tox_result = await asyncio.gather(inj_task, tox_task)
        
        # Determine which model triggered the highest risk
        highest_risk = max(inj_result["risk"], tox_result["risk"])
        
        reasons = []
        if inj_result["reason"]: reasons.append(inj_result["reason"])
        if tox_result["reason"]: reasons.append(tox_result["reason"])
        
        combined_reason = " | ".join(reasons) if reasons else "Safe"
        
        return highest_risk, combined_reason