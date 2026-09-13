import os
from agent.llm.base import LLMProvider


def get_llm_provider() -> LLMProvider:
    provider = os.getenv("LLM_PROVIDER", "openai").lower()
    if provider == "openai":
        from agent.llm.openai_provider import OpenAIProvider
        return OpenAIProvider()
    if provider == "anthropic":
        from agent.llm.anthropic_provider import AnthropicProvider
        return AnthropicProvider()
    raise ValueError(f"Unknown LLM_PROVIDER: {provider!r}. Must be 'openai' or 'anthropic'.")
