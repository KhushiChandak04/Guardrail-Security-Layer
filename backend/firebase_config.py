from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")

_db = None


def _candidate_credential_paths(explicit_credentials_path: str | None = None) -> list[Path]:
    configured_path = (explicit_credentials_path or os.getenv("FIREBASE_CREDENTIALS_PATH", "")).strip()
    candidates: list[Path] = []

    if configured_path:
        candidates.extend(
            [
                Path(configured_path),
                BACKEND_DIR / configured_path,
                Path.cwd() / configured_path,
            ]
        )

    candidates.extend(
        [
            BACKEND_DIR / "serviceAccountKey.json",
            BACKEND_DIR / "credentials" / "firebase-service-account.json",
        ]
    )

    # Support accidental double-extension downloads (for example serviceAccountKey.json.json).
    candidates.extend(sorted(BACKEND_DIR.glob("serviceAccountKey*.json")))

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key not in seen:
            seen.add(key)
            unique.append(candidate)

    return unique


def _resolve_credential_path(explicit_credentials_path: str | None = None) -> Path:
    for candidate in _candidate_credential_paths(explicit_credentials_path):
        if candidate.exists():
            return candidate.resolve()

    raise FileNotFoundError(
        "Firebase service account key not found. "
        "Place it at backend/serviceAccountKey.json or "
        "backend/credentials/firebase-service-account.json, or set "
        "FIREBASE_CREDENTIALS_PATH in backend/.env."
    )


def initialize_firebase(*, credentials_path: str | None = None, project_id: str | None = None):
    if firebase_admin._apps:
        return firestore.client()

    credential_path = _resolve_credential_path(credentials_path)
    cred = credentials.Certificate(str(credential_path))

    resolved_project_id = (project_id or os.getenv("FIREBASE_PROJECT_ID", "")).strip()
    options = {"projectId": resolved_project_id} if resolved_project_id else None

    firebase_admin.initialize_app(cred, options=options)
    return firestore.client()


def get_firestore_db(*, credentials_path: str | None = None, project_id: str | None = None):
    global _db
    if _db is None:
        _db = initialize_firebase(credentials_path=credentials_path, project_id=project_id)
    return _db


def log_interaction(data: dict) -> str:
    db = get_firestore_db()
    doc_ref = db.collection("interactions").document()
    doc_ref.set(data)
    return doc_ref.id


def write_test_document() -> str:
    db = get_firestore_db()
    doc_ref = db.collection("test").document()
    doc_ref.set(
        {
            "hello": "world",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return doc_ref.id