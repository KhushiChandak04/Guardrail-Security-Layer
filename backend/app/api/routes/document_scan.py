from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from services.document_extractor import extract_text
from app.guardrails.validators.document_validator import scan_document

router = APIRouter()

_ALLOWED_SUFFIXES = {".pdf", ".txt"}
_ALLOWED_CONTENT_TYPES = {"application/pdf", "text/plain"}


def _is_supported_file(file: UploadFile) -> bool:
    suffix = Path(file.filename or "").suffix.lower()
    content_type = (file.content_type or "").lower()
    return suffix in _ALLOWED_SUFFIXES or content_type in _ALLOWED_CONTENT_TYPES


@router.post("/scan-document")
async def scan_uploaded_document(file: UploadFile = File(...)) -> dict[str, object]:
    if not _is_supported_file(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Please upload a PDF or TXT file.",
        )

    extracted_text = extract_text(file)
    if not extracted_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract text from the uploaded file.",
        )

    return scan_document(extracted_text)
