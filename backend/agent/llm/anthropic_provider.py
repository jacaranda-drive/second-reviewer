import os
from anthropic import AsyncAnthropic
from agent.llm.base import LLMProvider


DEFAULT_TIMEOUT_SECONDS = 90.0


class AnthropicProvider(LLMProvider):
    def __init__(self):
        timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
        self.client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"), timeout=timeout)
        self._model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

    @property
    def provider_name(self) -> str:
        return "anthropic"

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(self, system: str, user: str) -> str:
        response = await self.client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text
