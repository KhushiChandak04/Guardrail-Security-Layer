from pydantic import BaseModel


class LogEntry(BaseModel):
    request_id: str
    user_id: str
    blocked: bool
    ingress_risk: str
    output_risk: str
    model: str
    reason: str
