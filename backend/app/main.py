from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.dependencies import get_firebase_service
from app.api.routes import chat, diagnostics, document_scan, health, logs
from app.config.settings import settings
from app.utils.logger import configure_logging

configure_logging()


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    firebase_service = get_firebase_service()
    await firebase_service.ensure_schema_initialized()
    yield

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Bidirectional security middleware for GenAI chatbot traffic.",
    lifespan=app_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon: allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router, prefix="/api")
app.include_router(diagnostics.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(document_scan.router)
