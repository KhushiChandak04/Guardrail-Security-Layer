from app.config.constants import TOXICITY_TERMS, WATCHLIST_TERMS


class ToxicityDetector:
    def score(self, text: str) -> tuple[float, str]:
        lower_text = text.lower()

        if any(term in lower_text for term in TOXICITY_TERMS):
            return 0.85, "Potentially harmful language detected"

        if any(term in lower_text for term in WATCHLIST_TERMS):
            return 0.55, "Watchlist security terms detected"

        return 0.05, "No toxicity pattern found"
