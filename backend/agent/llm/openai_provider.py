import os
from openai import AsyncOpenAI
from agent.llm.base import LLMProvider


DEFAULT_TIMEOUT_SECONDS = 90.0


class OpenAIProvider(LLMProvider):
    def __init__(self):
        timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=timeout)
        self._model = os.getenv("OPENAI_MODEL", "gpt-4o")

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(self, system: str, user: str) -> str:
        response = await self.client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
        )
        return response.choices[0].message.content
