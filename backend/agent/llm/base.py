from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str:
        """Returns raw string response from the model."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """e.g. 'openai' or 'anthropic'"""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """e.g. 'gpt-4o' or 'claude-sonnet-4-6'"""
