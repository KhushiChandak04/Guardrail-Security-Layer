from groq import AsyncGroq

from app.config.constants import DEFAULT_SYSTEM_PROMPT


class LLMService:
    def __init__(self, *, api_key: str, model: str, temperature: float) -> None:
        self.api_key = api_key
        self.model = model
        self.temperature = temperature
        self.client = AsyncGroq(api_key=api_key) if api_key else None

    async def generate(self, prompt: str) -> str:
        if not self.client:
            return (
                "[Stubbed LLM response] Set GROQ_API_KEY in backend/.env to enable live model generation. "
                f"Prompt preview: {prompt[:200]}"
            )

        completion = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
        )
        return completion.choices[0].message.content or ""
