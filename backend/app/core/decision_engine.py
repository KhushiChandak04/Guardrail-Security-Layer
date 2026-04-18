from dataclasses import dataclass


@dataclass
class InputDecision:
    blocked: bool
    risk_level: str
    reason: str
