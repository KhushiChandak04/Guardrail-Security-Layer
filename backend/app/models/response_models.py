from typing import Literal

from pydantic import BaseModel, Field


class ChatResponse(BaseModel):
    request_id: str
    message: str
    blocked: bool
    ingress_risk: Literal["low", "medium", "high"]
    output_risk: Literal["low", "medium", "high"]
    redactions: list[str] = Field(default_factory=list)
    timestamp: str


class DocumentScanResponse(BaseModel):
    risk: Literal["LOW", "MEDIUM", "HIGH"]
    detected: list[str] = Field(default_factory=list)
    message: str
