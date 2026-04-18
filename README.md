# Guardrail Security Layer

Bidirectional guardrail middleware for GenAI applications.

## Hackathon Problem Statement

GenAI copilots are vulnerable in both traffic directions.

1. Ingress (user -> model): prompt injection, jailbreak attempts, abuse instructions.
2. Egress (model -> user): PII leakage, unsafe responses, hallucinated risky content.

This project places a middleware checkpoint between users and foundation models to inspect, score, and optionally block or redact traffic in both directions.

## Bidirectional Security Flow

1. Client prompt arrives at middleware.
2. Ingress checks run (regex, toxicity, vector similarity to jailbreak corpus).
3. Prompt is blocked or forwarded to LLM.
4. LLM response returns to middleware.
5. Egress checks run (PII detection/redaction, risk scoring).
6. Safe response is returned to client.
7. Incident logs are written for auditing and monitoring.

## Monorepo Layout

```text
Guardrail-Security-Layer/
  backend/      # FastAPI guardrail middleware + tests
  frontend/     # React (Vite) chat UI
  extension/    # Browser extension scaffold (currently MV3 baseline)
  sdk/          # Python + JavaScript SDK starters
  shared/       # Shared schemas/constants
  docs/         # Architecture, API, setup, demo notes
```

## Stack Coverage (Current State)

### Part A: Browser Extension (Client UI)

- MV3 extension scaffold: implemented.
- React popup runtime via Plasmo: not yet implemented (currently scaffold scripts only).
- Tailwind in extension: not yet implemented.
- Shadow DOM isolation: not yet implemented.
- Firebase Auth in extension: not yet implemented.
- WebSocket helper: scaffolded.

### Part B: Frontend App (Single UI)

- React + Vite chat UI: implemented.
- Firebase Auth integration: implemented.
- Session-aware API submission and metadata logging: implemented.
- Incident visibility is handled through backend logs and Firestore records.

### Part C: Middleware (Brain + Security Hub)

- FastAPI core API + WS route: implemented.
- ChromaDB + SentenceTransformers ingress similarity checks: implemented.
- Presidio analyzer-based PII detection: implemented.
- Groq integration with safe fallback mode: implemented.
- Firebase Admin token/log pipeline with local fallback: implemented.

## Tech Stack (Target Blueprint)

- Extension: Plasmo, React, Tailwind CSS, Shadow DOM, Firebase Auth client, WebSockets
- Middleware: FastAPI, ChromaDB, SentenceTransformers, Presidio, Groq API, Firebase Admin SDK

## Scratch Setup For Team (End-To-End)

### 1) Clone + Prerequisites

Required:

- Windows PowerShell
- Python 3.11+
- Node.js 20+
- npm 10+

```powershell
git clone <your-repo-url>
cd Guardrail-Security-Layer
```

### 2) Python Environment + Backend Dependencies

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Optional (improves Presidio NLP quality):

```powershell
python -m spacy download en_core_web_lg
```

### 3) Node Workspaces Install (Frontend, Extension, SDK JS)

```powershell
npm install
```

### 4) Firebase Setup + Environment Files

Project details for this repository:

- App nickname: Guardrail-Security-Layer
- Firebase project ID: guardrail-security-layer
- Firebase App ID: 1:428591962866:web:e53578084b4f2258dece6b
- Hosting site: guardrail-security-layer

4.1 Configure Firebase resources in console:

1. Create Firestore database in Native mode.
2. Enable Authentication providers:
  - Google
  - Email/Password
3. Create a service account key from Project Settings -> Service accounts -> Generate new private key.
4. Save the JSON file at backend/credentials/firebase-service-account.json.

4.2 Environment policy used in this repo:

- Runtime env files used:
  - `backend/.env`
  - `frontend/.env`
- All `.env` files and service-account JSON files are gitignored.

Required env files and locations:

- backend/.env
- frontend/.env

4.3 backend/.env values:

```dotenv
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
MODELS_LOCAL_ONLY=true
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
EMBEDDING_MODEL_PATH=./models/all-MiniLM-L6-v2
PROMPT_INJECTION_MODEL_NAME=protectai/deberta-v3-base-prompt-injection
PROMPT_INJECTION_MODEL_PATH=./models/deberta-v3-base-prompt-injection
TOXICITY_MODEL_NAME=unitary/toxic-bert
TOXICITY_MODEL_PATH=./models/toxic-bert

CHROMA_PATH=./.chroma
CHROMA_COLLECTION=jailbreak_patterns
JAILBREAK_SIMILARITY_THRESHOLD=0.79
JAILBREAK_SEED_FILE=./app/data/jailbreak_seed.txt
INGRESS_BLOCK_THRESHOLD=70
INGRESS_SANITIZE_THRESHOLD=40

FIREBASE_PROJECT_ID=guardrail-security-layer
FIREBASE_CREDENTIALS_PATH=backend/credentials/firebase-service-account.json
FIRESTORE_INTERACTIONS_COLLECTION=interactions
FIRESTORE_SESSIONS_COLLECTION=sessions
FIRESTORE_USERS_COLLECTION=users
FIRESTORE_POLICIES_COLLECTION=policies
FIRESTORE_THREAT_PATTERNS_COLLECTION=threat_patterns
FIRESTORE_ANALYTICS_CACHE_COLLECTION=analytics_cache
```

4.3.1 Local model setup (repo-first, no runtime HF download):

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\setup_local_models.py
```

This command populates these folders inside the repository:

- backend/models/all-MiniLM-L6-v2
- backend/models/deberta-v3-base-prompt-injection
- backend/models/toxic-bert

Step 4: Initialize Firebase in backend (already added in codebase)

- File: `backend/firebase_config.py`
- Includes Admin SDK initialization + helper:
  - `initialize_firebase()`
  - `log_interaction(data)`

Step 5: Test connection (temporary write)

Run:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\test_firebase_connection.py
```

If successful, Firestore gets a `test` collection document with `{"hello": "world"}`.

4.4 Frontend Firebase web config:

- Values from your Firebase web app are loaded from:
  - frontend/.env (VITE_FIREBASE_*)
- These are Firebase client config values (public identifiers), not private keys.
- Do not place service-account JSON or other backend secrets in frontend source.
- Optional frontend API override (recommended for local consistency):

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

4.5 Optional Firebase CLI setup (only if you deploy hosting from this repo):

```powershell
npm install -g firebase-tools
firebase login
firebase use guardrail-security-layer
firebase init hosting
```

4.6 Firestore schema is created by backend code (automatic):

- No manual table/collection creation is required beyond enabling Firestore in Firebase console.
- No static placeholder interaction rows are written.
- On backend startup/bootstrap, the middleware seeds policy configuration docs only:
  - policies/default_policy
  - threat_patterns/* baseline docs
- On each `/api/chat` request (UI, SDK, or websocket), it writes live interaction/session/analytics records automatically.

Optional force-bootstrap command (not required for normal runtime):

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\bootstrap_firestore_schema.py
```

4.7 Firestore collections used by backend:

- interactions
- sessions
- users
- policies
- threat_patterns
- analytics_cache

Detailed schema reference: docs/firestore_schema.md

Intelligence integration note:
- Threat pattern documents are synchronized from backend logic files (`regex_rules.py`) and jailbreak seed data (`jailbreak_seed.txt`) during backend schema bootstrap.
- Guardrail block/sanitize thresholds are read from `backend/.env` and written into `policies/default_policy`.

### 5) Run Services (Current Codebase)

Run from repo root in two separate terminals:

Terminal 1 (backend):

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir app --host 127.0.0.1 --port 8000
```

Terminal 2 (frontend):

```powershell
npm run dev:frontend
```

Notes:

- Backend accepts localhost frontend origins on any port (for example 5173, 5174, 5175), so Vite port auto-switching should not cause CORS failures.
- If backend appears to restart repeatedly, ensure you are using the command above with `--reload-dir app` from inside the backend folder.
- Root scripts now auto-clear occupied dev ports before startup (`8000` for backend, `5173` for frontend) so local URLs stay fixed.

Optional backend shortcut from repo root:

```powershell
npm run dev:backend
```

Stable backend mode (no auto-reload, fewer connection resets during long browser sessions):

```powershell
npm run dev:backend:stable
```

Extension (current scaffold mode):

```powershell
npm run dev:extension
```

### 6) Validation Commands

Backend tests:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe -m pytest -q backend/tests
```

Route map:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\print_routes.py
```

Frontend production build check:

```powershell
npm run build --workspace @guardrail/frontend
```

Secret safety check (before push):

```powershell
npm run security:scan
```

Optional full-history check:

```powershell
npm run security:scan-history
```

### 7) Troubleshooting: ERR_CONNECTION_RESET

If browser shows `ERR_CONNECTION_RESET` for backend:

1. Use HTTP only (not HTTPS):
  - `http://127.0.0.1:8000/`
  - `http://localhost:8000/`
2. Do not use `0.0.0.0` in browser URL. It is a bind address, not a client URL.
3. For maximum stability during demo, run:

```powershell
npm run dev:backend:stable
```

4. Verify listener:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
```

Expected behavior:
- `GET /` returns service JSON with routes
- `GET /health` returns `{"status":"ok"}`

## Upgrade Commands To Match Full Blueprint Exactly

Use this section if your team wants to implement the remaining extension features in this sprint.

### A) Extension Upgrade (Plasmo + React + Tailwind + Firebase Auth)

Option 1 (fresh extension rebuild):

```powershell
npm create plasmo@latest extension -- --template react
```

Option 2 (upgrade existing extension workspace):

```powershell
npm install --workspace @guardrail/extension react react-dom firebase
npm install --workspace @guardrail/extension -D plasmo tailwindcss postcss autoprefixer
```

Then add scripts in extension workspace:

```json
{
  "scripts": {
    "dev": "plasmo dev",
    "build": "plasmo build",
    "package": "plasmo package"
  }
}
```

## API Surface

- GET /
- GET /health
- POST /api/chat
- GET /api/diagnostics/guardrails
- GET /api/logs
- WS /api/ws/chat

## 5-Minute Judge Demo Flow

1. Submit safe prompt from frontend and show normal pass-through.
2. Submit jailbreak-style prompt and show ingress block.
3. Submit PII-containing prompt and show egress redaction.
4. Open frontend and display incident log behavior from live interactions.
5. Show tests + route map as implementation proof.

## Implementation Notes

- Firebase and Groq are both optional in local development; middleware has fallback behavior.
- Extension still contains scaffold sections by design, so teams can layer enterprise features without breaking the demo baseline.
