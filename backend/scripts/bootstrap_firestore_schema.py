import asyncio

from app.api.dependencies import get_firebase_service


async def main() -> None:
    firebase_service = get_firebase_service()
    if not firebase_service.enabled:
        print("Firebase is not enabled. Check backend/.env and service account file path.")
        return

    created = await firebase_service.bootstrap_schema()
    if created:
        print("Firestore schema bootstrap complete.")
    else:
        print("Firestore schema bootstrap failed.")


if __name__ == "__main__":
    asyncio.run(main())
