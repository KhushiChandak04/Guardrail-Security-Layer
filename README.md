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
7. Incident logs are written for auditing and dashboard monitoring.

## Monorepo Layout

```text
Guardrail-Security-Layer/
  backend/      # FastAPI guardrail middleware + tests
  frontend/     # React (Vite) chat UI
  dashboard/    # Next.js admin dashboard
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

### Part B: Admin Dashboard (Command Center)

- Next.js + React: implemented.
- Recharts visualizations: implemented.
- Firebase client initialization: implemented.
- Firestore onSnapshot live listeners: not yet implemented (current incident table is static sample data).
- shadcn/ui component system: not yet implemented.

### Part C: Middleware (Brain + Security Hub)

- FastAPI core API + WS route: implemented.
- ChromaDB + SentenceTransformers ingress similarity checks: implemented.
- Presidio analyzer-based PII detection: implemented.
- Groq integration with safe fallback mode: implemented.
- Firebase Admin token/log pipeline with local fallback: implemented.

## Tech Stack (Target Blueprint)

- Extension: Plasmo, React, Tailwind CSS, Shadow DOM, Firebase Auth client, WebSockets
- Dashboard: Next.js, shadcn/ui, Recharts, Firestore onSnapshot
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

### 3) Node Workspaces Install (Frontend, Dashboard, Extension, SDK JS)

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

- Only one runtime env file is used: `backend/.env`.
- Frontend and dashboard use the Firebase web config constants already committed in source.
- `backend/.env` and service-account JSON files are gitignored.

Required env files and locations:

- backend/.env

4.3 backend/.env values:

```dotenv
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

CHROMA_PATH=./.chroma
CHROMA_COLLECTION=jailbreak_patterns
JAILBREAK_SIMILARITY_THRESHOLD=0.79
JAILBREAK_SEED_FILE=./app/data/jailbreak_seed.txt

FIREBASE_PROJECT_ID=guardrail-security-layer
FIREBASE_CREDENTIALS_PATH=backend/credentials/firebase-service-account.json
FIRESTORE_INTERACTIONS_COLLECTION=interactions
FIRESTORE_SESSIONS_COLLECTION=sessions
FIRESTORE_USERS_COLLECTION=users
FIRESTORE_POLICIES_COLLECTION=policies
FIRESTORE_THREAT_PATTERNS_COLLECTION=threat_patterns
FIRESTORE_ANALYTICS_CACHE_COLLECTION=analytics_cache
```

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

4.4 Frontend + dashboard Firebase web config:

- Values from your Firebase web app are stored in:
  - dashboard/src/services/firebase.js
  - frontend/src/services/firebase.js
- These are Firebase client config values (public identifiers), not private keys.
- Do not place service-account JSON or other backend secrets in frontend/dashboard source.

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

### 5) Run Services (Current Codebase)

Run each command from repo root in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:dashboard
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

Frontend + dashboard production build check:

```powershell
npm run build --workspace @guardrail/frontend
npm run build --workspace @guardrail/dashboard
```

## Upgrade Commands To Match Full Blueprint Exactly

Use this section if your team wants to implement the remaining extension/dashboard features in this sprint.

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

### B) Dashboard Upgrade (shadcn/ui + Live Firestore onSnapshot)

Install core UI dependencies:

```powershell
npm install --workspace @guardrail/dashboard class-variance-authority clsx tailwind-merge lucide-react @radix-ui/react-slot
```

Initialize shadcn/ui in dashboard workspace:

```powershell
cd dashboard
npx shadcn@latest init
```

For live incidents, wire Firestore listener using `onSnapshot()` in dashboard services and subscribe from log/stat components.

## API Surface

- GET /health
- POST /api/chat
- GET /api/logs
- WS /api/ws/chat

## 5-Minute Judge Demo Flow

1. Submit safe prompt from frontend and show normal pass-through.
2. Submit jailbreak-style prompt and show ingress block.
3. Submit PII-containing prompt and show egress redaction.
4. Open dashboard and display incident analytics/log entries.
5. Show tests + route map as implementation proof.

## Implementation Notes

- Firebase and Groq are both optional in local development; middleware has fallback behavior.
- Extension and dashboard still contain scaffold sections by design, so teams can layer enterprise features without breaking the demo baseline.
