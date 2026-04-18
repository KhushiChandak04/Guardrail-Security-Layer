def score_to_risk(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.55:
        return "medium"
    return "low"
