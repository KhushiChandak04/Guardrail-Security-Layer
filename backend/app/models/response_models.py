from typing import Literal

from pydantic import BaseModel, Field


class ChatResponse(BaseModel):
    request_id: str
    message: str
    blocked: bool
    ingress_risk: Literal["low", "medium", "high"]
    ingress_score: float | None = None
    output_risk: Literal["low", "medium", "high"]
    output_score: float | None = None
    redactions: list[str] = Field(default_factory=list)
    timestamp: str
    rephrased_prompt: str | None = None


class DocumentScanResponse(BaseModel):
    risk: Literal["LOW", "MEDIUM", "HIGH"]
    detected: list[str] = Field(default_factory=list)
    message: str
