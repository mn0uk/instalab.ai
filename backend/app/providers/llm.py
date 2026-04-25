from __future__ import annotations

import json
import logging
from typing import Any, Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential

from ..settings import get_settings


logger = logging.getLogger(__name__)


T = TypeVar("T", bound=BaseModel)


class LLMProvider:
    """OpenAI-backed JSON generator with schema validation."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        temperature: float | None = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.openai_api_key
        self.model = model or settings.llm_model
        self.temperature = settings.llm_temperature if temperature is None else temperature
        self._client = OpenAI(api_key=self.api_key) if self.api_key else None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    @retry(
        reraise=True,
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=1, max=8),
    )
    def generate_json(self, *, system: str, user: str) -> dict[str, Any]:
        if not self.enabled:
            raise RuntimeError("LLM disabled (missing OPENAI_API_KEY).")
        response = self._client.chat.completions.create(
            model=self.model,
            temperature=self.temperature,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        content = response.choices[0].message.content or "{}"
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            logger.warning("LLM returned non-JSON content; returning raw text wrapper.")
            return {"raw": content}

    def generate_model(self, *, system: str, user: str, schema: Type[T]) -> T:
        data = self.generate_json(system=system, user=user)
        try:
            return schema.model_validate(data)
        except ValidationError:
            logger.exception("LLM output failed schema validation for %s", schema.__name__)
            raise
