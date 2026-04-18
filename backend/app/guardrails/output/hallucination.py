class HallucinationChecker:
    def score(self, output: str) -> float:
        # Placeholder heuristic for MVP; replace with factuality checks in phase 2.
        lower = output.lower()
        if "i am certain" in lower and "cannot verify" in lower:
            return 0.7
        return 0.1
