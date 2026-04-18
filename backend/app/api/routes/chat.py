import json
from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.dependencies import get_auth_service, get_firebase_service, get_guardrail_engine, get_llm_service
from app.core.guardrail_engine import GuardrailEngine
from app.models.request_models import ChatRequest
from app.models.response_models import ChatResponse
from app.services.auth_service import AuthService
from app.services.firebase_service import FirebaseService
from app.services.llm_service import LLMService
from app.utils.helpers import now_utc_iso

router = APIRouter()


async def process_chat(
    payload: ChatRequest,
    *,
    guardrail_engine: GuardrailEngine,
    llm_service: LLMService,
    firebase_service: FirebaseService,
    auth_service: AuthService,
    request_source: str,
) -> ChatResponse:
    request_id = str(uuid4())
    user = await auth_service.verify_id_token(payload.id_token)
    user_id = user.get("uid", "anonymous")
    user_email = user.get("email", "")
    interaction_metadata = dict(payload.metadata)
    # interaction_metadata.setdefault("source", request_source)
    # interaction_metadata.setdefault("prompt_length", str(len(payload.prompt)))

    # input_verdict = guardrail_engine.validate_input(payload.prompt)
    # input_was_sanitized = bool(input_verdict.sanitized_prompt and input_verdict.sanitized_prompt != payload.prompt)
    interaction_metadata.setdefault("source", request_source)
    interaction_metadata.setdefault("prompt_length", str(len(payload.prompt)))
    document_was_provided = bool(payload.document_text and payload.document_text.strip())
    interaction_metadata.setdefault("document_provided", str(document_was_provided).lower())

    # Add the await keyword here since validate_input now runs concurrent async ML tasks
    input_verdict = await guardrail_engine.validate_input(payload.prompt) 
    
    input_was_sanitized = bool(input_verdict.sanitized_prompt and input_verdict.sanitized_prompt != payload.prompt)
    interaction_metadata.setdefault("ingress_risk", input_verdict.risk_level)
    interaction_metadata.setdefault("ingress_reason", input_verdict.reason)
    interaction_metadata.setdefault("input_was_sanitized", str(input_was_sanitized).lower())

    sanitized_document_text: str | None = None
    if document_was_provided:
        document_verdict = guardrail_engine.validate_document(payload.document_text or "")
        interaction_metadata.setdefault("document_risk", document_verdict.risk_level)
        interaction_metadata.setdefault("document_reason", document_verdict.reason)

        if document_verdict.blocked:
            interaction_timestamp = now_utc_iso()
            blocked_response = ChatResponse(
                request_id=request_id,
                message=f"Request blocked: {document_verdict.reason}",
                blocked=True,
                ingress_risk="high",
                output_risk="low",
                redactions=[],
                timestamp=interaction_timestamp,
            )

            await firebase_service.log_interaction(
                user_id=user_id,
                user_email=user_email,
                session_id=payload.session_id,
                prompt_text=payload.prompt,
                input_sanitized=input_was_sanitized,
                input_risk_level="high",
                input_reason=document_verdict.reason,
                blocked=True,
                model=llm_service.model,
                llm_latency_ms=0,
                output_text=None,
                output_risk_level=None,
                redactions=[],
                metadata=interaction_metadata,
                request_id=request_id,
                timestamp=interaction_timestamp,
            )
            return blocked_response

        sanitized_document_text = document_verdict.sanitized_text

    if input_verdict.blocked:
        interaction_timestamp = now_utc_iso()
        blocked_response = ChatResponse(
            request_id=request_id,
            message=f"Request blocked: {input_verdict.reason}",
            blocked=True,
            ingress_risk=input_verdict.risk_level,
            output_risk="low",
            redactions=[],
            timestamp=interaction_timestamp,
        )

        await firebase_service.log_interaction(
            user_id=user_id,
            user_email=user_email,
            session_id=payload.session_id,
            prompt_text=payload.prompt,
            input_sanitized=input_was_sanitized,
            input_risk_level=input_verdict.risk_level,
            input_reason=input_verdict.reason,
            blocked=True,
            model=llm_service.model,
            llm_latency_ms=0,
            output_text=None,
            output_risk_level=None,
            redactions=[],
            metadata=interaction_metadata,
            request_id=request_id,
            timestamp=interaction_timestamp,
        )
        return blocked_response

    llm_started_at = perf_counter()
    llm_input = guardrail_engine.build_llm_input(
        prompt=input_verdict.sanitized_prompt,
        sanitized_document_text=sanitized_document_text,
    )
    llm_output = await llm_service.generate(llm_input)
    llm_latency_ms = int((perf_counter() - llm_started_at) * 1000)
    safe_output, redactions, output_risk = guardrail_engine.validate_output(llm_output)

    interaction_timestamp = now_utc_iso()

    response = ChatResponse(
        request_id=request_id,
        message=safe_output,
        blocked=False,
        ingress_risk=input_verdict.risk_level,
        output_risk=output_risk,
        redactions=redactions,
        timestamp=interaction_timestamp,
    )

    await firebase_service.log_interaction(
        user_id=user_id,
        user_email=user_email,
        session_id=payload.session_id,
        prompt_text=payload.prompt,
        input_sanitized=input_was_sanitized,
        input_risk_level=input_verdict.risk_level,
        input_reason=input_verdict.reason,
        blocked=False,
        model=llm_service.model,
        llm_latency_ms=llm_latency_ms,
        output_text=safe_output,
        output_risk_level=output_risk,
        redactions=redactions,
        metadata=interaction_metadata,
        request_id=request_id,
        timestamp=interaction_timestamp,
    )

    return response


@router.post("/chat", response_model=ChatResponse)
async def guarded_chat(
    payload: ChatRequest,
    guardrail_engine: GuardrailEngine = Depends(get_guardrail_engine),
    llm_service: LLMService = Depends(get_llm_service),
    firebase_service: FirebaseService = Depends(get_firebase_service),
    auth_service: AuthService = Depends(get_auth_service),
) -> ChatResponse:
    return await process_chat(
        payload,
        guardrail_engine=guardrail_engine,
        llm_service=llm_service,
        firebase_service=firebase_service,
        auth_service=auth_service,
        request_source="rest_api",
    )


@router.websocket("/ws/chat")
async def guarded_chat_ws(
    websocket: WebSocket,
    guardrail_engine: GuardrailEngine = Depends(get_guardrail_engine),
    llm_service: LLMService = Depends(get_llm_service),
    firebase_service: FirebaseService = Depends(get_firebase_service),
    auth_service: AuthService = Depends(get_auth_service),
) -> None:
    await websocket.accept()

    while True:
        try:
            payload_text = await websocket.receive_text()
        except WebSocketDisconnect:
            break

        try:
            payload_raw = json.loads(payload_text)
            if isinstance(payload_raw, str):
                payload = ChatRequest(prompt=payload_raw)
            else:
                payload = ChatRequest.model_validate(payload_raw)
        except Exception as error:
            error_response = ChatResponse(
                request_id=str(uuid4()),
                message=f"Invalid websocket payload: {error}",
                blocked=True,
                ingress_risk="high",
                output_risk="low",
                redactions=[],
                timestamp=now_utc_iso(),
            )
            await websocket.send_text(error_response.model_dump_json())
            continue

        response = await process_chat(
            payload,
            guardrail_engine=guardrail_engine,
            llm_service=llm_service,
            firebase_service=firebase_service,
            auth_service=auth_service,
            request_source="websocket",
        )
        await websocket.send_text(response.model_dump_json())
