from datetime import datetime, timezone
from uuid import uuid4

import httpx

from guardrail.config import SDKConfig


class Client:
    def __init__(self, api_key: str, base_url: str = "http://localhost:8000") -> None:
        self.config = SDKConfig(api_key=api_key, base_url=base_url)
        self.session_id = str(uuid4())

    def process(
        self,
        prompt: str,
        *,
        session_id: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> dict:
        payload_metadata = {
            "source": "sdk_python",
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
            "sdk": "python",
            "prompt_length": str(len(prompt)),
        }
        if metadata:
            payload_metadata.update(metadata)

        response = httpx.post(
            f"{self.config.base_url}/api/chat",
            json={
                "prompt": prompt,
                "session_id": session_id or self.session_id,
                "metadata": payload_metadata,
            },
            timeout=20,
        )
        response.raise_for_status()
        return response.json()
