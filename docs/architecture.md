# Architecture

This project uses a monorepo with a FastAPI guardrail backend, a unified frontend app, an optional extension, and SDK wrappers.

Traffic flow:

1. Client sends prompt to backend.
2. Backend applies ingress checks.
3. If allowed, backend calls LLM.
4. Backend applies output checks and redaction.
5. Response is returned and incidents are logged.
