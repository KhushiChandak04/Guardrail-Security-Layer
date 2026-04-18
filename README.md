# Guardrail Security Layer

Bidirectional guardrail middleware for GenAI applications.

## Hackathon Problem Statement

GenAI copilots are vulnerable in two directions:

1. Ingress risk: users can attempt prompt injection, jailbreaks, abuse, and policy bypass.
2. Egress risk: model responses can leak PII, hallucinate unsafe guidance, or violate policy.

Most demos secure only one side. This project solves both sides with a single middleware layer that can be dropped in front of any chatbot stack.

## What This Project Delivers

- Real-time ingress checks before LLM execution.
- Real-time egress checks and redaction before user delivery.
- Risk scoring and allow/block decisioning.
- Incident logging for auditability and dashboard visibility.
- SDK and extension scaffolds for quick integrations.

## Why It Fits a Hackathon

- Clear, high-impact problem with immediate business relevance.
- End-to-end demonstrable flow (attack attempt, policy block, and forensic log trail).
- Practical architecture that teams can extend after judging.

## System Flow

1. Client sends prompt to backend.
2. Ingress guardrails inspect text (injection, toxicity, jailbreak similarity, regex policies).
3. Decision engine assigns risk and either blocks or allows.
4. Allowed prompt goes to LLM service.
5. Egress guardrails inspect output (PII/hallucination/policy checks).
6. Sensitive content is redacted when needed.
7. Final response + incident metadata are returned and logged.

## Monorepo Layout

```text
Guardrail-Security-Layer/
  backend/      # FastAPI guardrail middleware and tests
  frontend/     # React (Vite) chat demo UI
  dashboard/    # Next.js admin and analytics UI
  extension/    # Browser extension scaffold (MV3)
  sdk/          # Python + JavaScript client starters
  shared/       # Shared schema/constants
  docs/         # Architecture, API, setup, and demo notes
```

## Tech Stack

- Backend: FastAPI, Pydantic Settings, ChromaDB, SentenceTransformers, Presidio, Groq SDK, Firebase Admin
- Frontend: React + Vite + Axios
- Dashboard: Next.js + Recharts + Firebase client
- Tooling: npm workspaces, pytest

## Dependency Hygiene Rules

- Python dependencies are installed only from backend/requirements.txt into root .venv.
- Node dependencies are installed from repository root via npm workspaces.
- Do not run standalone npm install inside frontend/dashboard/extension unless intentionally debugging one workspace.

Reference install commands:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
npm install
```

## Environment Setup

Create local env files:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item dashboard\.env.example dashboard\.env.local
```

Minimum backend environment variables:

- APP_ENV
- APP_HOST
- APP_PORT
- ALLOWED_ORIGINS
- GROQ_API_KEY (optional for stub mode)
- GROQ_MODEL
- CHROMA_PATH
- CHROMA_COLLECTION
- JAILBREAK_SIMILARITY_THRESHOLD
- JAILBREAK_SEED_FILE
- FIREBASE_PROJECT_ID
- FIREBASE_CREDENTIALS_PATH (optional)
- FIRESTORE_COLLECTION

Notes:

- If Firebase credentials are empty, backend safely falls back to local logging mode.
- If GROQ_API_KEY is empty, backend returns fallback output for local development.

## Run The Project

From repository root:

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:dashboard
```

Optional placeholder:

```powershell
npm run dev:extension
```

## API Surface

- GET /health
- POST /api/chat
- GET /api/logs
- WS /api/ws/chat

## Validation Commands

Run tests (verified command):

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe -m pytest -q backend/tests
```

Print route table:

```powershell
$env:PYTHONPATH='backend'; .\.venv\Scripts\python.exe backend\scripts\print_routes.py
```

## 5-Minute Demo Script (Judging Friendly)

1. Open frontend and submit a normal prompt.
2. Submit a known jailbreak/policy-violating prompt to show block behavior.
3. Submit PII-like data and show egress redaction.
4. Open dashboard to show incident summary and risk analytics.
5. Show backend route map and tests to prove implementation integrity.

## What Is Already Implemented

- Ingress and egress guardrail pipeline.
- Risk-based block/allow decisions.
- Incident logging path with local fallback.
- Frontend chat demo.
- Dashboard analytics/log views.
- Workspace-scoped dependency setup and reproducible tests.

## Next Extensions After Hackathon

- Add role-based policy packs per domain (finance/healthcare/education).
- Add streaming moderation hooks for token-level response control.
- Add signed audit export and SIEM integration.
