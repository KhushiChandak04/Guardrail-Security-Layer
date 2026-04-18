# Backend Firebase Credentials

Place your Firebase Admin service account JSON in this folder with this exact name:

firebase-service-account.json

Expected path used by backend env:

backend/credentials/firebase-service-account.json

How to create the key:

1. Open Firebase Console for project guardrail-security-layer.
2. Go to Project Settings -> Service accounts.
3. Click Generate new private key.
4. Save the downloaded JSON as backend/credentials/firebase-service-account.json.

Do not commit credential JSON files to git.
