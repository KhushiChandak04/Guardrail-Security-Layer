import json
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
from app.utils.security_utils import preview_text

router = APIRouter()


async def process_chat(
    payload: ChatRequest,
    *,
    guardrail_engine: GuardrailEngine,
    llm_service: LLMService,
    firebase_service: FirebaseService,
    auth_service: AuthService,
) -> ChatResponse:
    request_id = str(uuid4())
    user = await auth_service.verify_id_token(payload.id_token)

    input_verdict = guardrail_engine.validate_input(payload.prompt)
    if input_verdict.blocked:
        blocked_response = ChatResponse(
            request_id=request_id,
            message=f"Request blocked: {input_verdict.reason}",
            blocked=True,
            ingress_risk=input_verdict.risk_level,
            output_risk="low",
            redactions=[],
            timestamp=now_utc_iso(),
        )

        await firebase_service.log_incident(
            user_id=user.get("uid", "anonymous"),
            prompt_preview=preview_text(payload.prompt),
            response_preview=preview_text(blocked_response.message),
            blocked=True,
            ingress_risk=input_verdict.risk_level,
            output_risk="low",
            redactions=[],
            model=llm_service.model,
            reason=input_verdict.reason,
            session_id=payload.session_id,
            metadata=payload.metadata,
            request_id=request_id,
        )
        return blocked_response

    llm_output = await llm_service.generate(payload.prompt)
    safe_output, redactions, output_risk = guardrail_engine.validate_output(llm_output)

    response = ChatResponse(
        request_id=request_id,
        message=safe_output,
        blocked=False,
        ingress_risk=input_verdict.risk_level,
        output_risk=output_risk,
        redactions=redactions,
        timestamp=now_utc_iso(),
    )

    if input_verdict.risk_level != "low" or output_risk != "low" or redactions:
        await firebase_service.log_incident(
            user_id=user.get("uid", "anonymous"),
            prompt_preview=preview_text(payload.prompt),
            response_preview=preview_text(safe_output),
            blocked=False,
            ingress_risk=input_verdict.risk_level,
            output_risk=output_risk,
            redactions=redactions,
            model=llm_service.model,
            reason=input_verdict.reason,
            session_id=payload.session_id,
            metadata=payload.metadata,
            request_id=request_id,
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
        )
        await websocket.send_text(response.model_dump_json())
