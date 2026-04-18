import httpx

from guardrail.config import SDKConfig


class Client:
    def __init__(self, api_key: str, base_url: str = "http://localhost:8000") -> None:
        self.config = SDKConfig(api_key=api_key, base_url=base_url)

    def process(self, prompt: str) -> dict:
        response = httpx.post(
            f"{self.config.base_url}/api/chat",
            json={"prompt": prompt, "metadata": {"sdk": "python"}},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()
