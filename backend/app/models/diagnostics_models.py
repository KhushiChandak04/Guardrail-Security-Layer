from pydantic import BaseModel, Field


class RuntimePolicyDiagnostics(BaseModel):
    ingress_block_threshold: int
    ingress_sanitize_threshold: int
    jailbreak_similarity_threshold: float


class VectorIntelligenceDiagnostics(BaseModel):
    collection: str
    seed_file: str
    seed_pattern_count: int
    embedding_model: str
    embedding_model_name: str
    embedding_model_path: str
    embedding_model_local: bool


class LLMModelDiagnostics(BaseModel):
    provider: str
    model: str
    temperature: float


class MLModelsDiagnostics(BaseModel):
    local_only: bool
    llm: LLMModelDiagnostics
    prompt_injection_model: str
    prompt_injection_model_name: str
    prompt_injection_model_path: str
    prompt_injection_model_local: bool
    toxicity_model: str
    toxicity_model_name: str
    toxicity_model_path: str
    toxicity_model_local: bool


class GuardrailDiagnosticsResponse(BaseModel):
    status: str
    timestamp: str
    runtime_policy: RuntimePolicyDiagnostics
    vector_intelligence: VectorIntelligenceDiagnostics
    ml_models: MLModelsDiagnostics
    storage: dict[str, object] = Field(default_factory=dict)
