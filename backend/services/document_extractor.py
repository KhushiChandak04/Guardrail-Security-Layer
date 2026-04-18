from io import BytesIO
import re

from fastapi import UploadFile
from PyPDF2 import PdfReader


def _clean_text(text: str) -> str:
    normalized = text.replace("\x00", " ")
    normalized = re.sub(r"\r\n?", "\n", normalized)
    normalized = re.sub(r"[\t ]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def _is_pdf(file: UploadFile) -> bool:
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    return filename.endswith(".pdf") or content_type == "application/pdf"


def _is_txt(file: UploadFile) -> bool:
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    return filename.endswith(".txt") or content_type.startswith("text/")


def _extract_pdf_text(file: UploadFile) -> str:
    file.file.seek(0)
    pdf_bytes = file.file.read()
    reader = PdfReader(BytesIO(pdf_bytes))

    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")

    return "\n".join(pages)


def _extract_txt_text(file: UploadFile) -> str:
    file.file.seek(0)
    raw = file.file.read()

    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="ignore")


def extract_text(file: UploadFile) -> str:
    try:
        if _is_pdf(file):
            return _clean_text(_extract_pdf_text(file))

        if _is_txt(file):
            return _clean_text(_extract_txt_text(file))

        return ""
    except Exception:
        return ""
