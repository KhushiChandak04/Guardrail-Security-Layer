from dataclasses import dataclass


@dataclass
class ValidationResult:
    score: float
    reason: str
