from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    document_text: str | None = Field(default=None, max_length=100000)
    id_token: str | None = None
    session_id: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)
