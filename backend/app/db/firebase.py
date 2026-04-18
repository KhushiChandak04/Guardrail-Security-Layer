import firebase_admin
from firebase_admin import firestore


def get_firestore_client():
    if not firebase_admin._apps:
        return None
    return firestore.client()
