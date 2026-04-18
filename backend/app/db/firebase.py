from firebase_config import get_firestore_db


def get_firestore_client():
    try:
        return get_firestore_db()
    except Exception:
        return None
