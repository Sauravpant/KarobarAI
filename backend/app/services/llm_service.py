from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional, TypeVar

import httpx
from fastapi import HTTPException, status
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-3.5-flash"
GROQ_MODEL = "openai/gpt-oss-120b"
# Free tier; OpenRouter tries these in order server-side (free models 429 often).
OPENROUTER_MODELS = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "google/gemma-4-31b-it:free",
    "qwen/qwen3.8-27b:free",
]
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
LLM_TIMEOUT_S = 30

T = TypeVar("T", bound=BaseModel)

_ai_client = None
_groq_client = None
_openrouter_client = None


def _get_ai_client():
    global _ai_client
    if _ai_client is None:
        if not settings.GEMINI_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GEMINI_API_KEY is not configured",
            )
        os.environ.setdefault("GEMINI_API_KEY", settings.GEMINI_API_KEY)
        _ai_client = genai.Client()
    return _ai_client


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not settings.GROQ_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="GROQ_API_KEY is not configured",
            )
        from groq import AsyncGroq

        _groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    return _groq_client


def _get_openrouter_client():
    global _openrouter_client
    if _openrouter_client is None:
        if not settings.OPENROUTER_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OPENROUTER_API_KEY is not configured",
            )
        _openrouter_client = httpx.AsyncClient(
            base_url=OPENROUTER_BASE_URL,
            headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
            timeout=LLM_TIMEOUT_S,
        )
    return _openrouter_client


def _with_json_instructions(prompt: str, json_schema: type[BaseModel]) -> str:
    schema = json.dumps(json_schema.model_json_schema(), ensure_ascii=False)
    return f"{prompt}\n\nReturn only a JSON object that matches this JSON Schema:\n{schema}"


async def _gemini(prompt: str, json_schema, temperature: float) -> str:
    config = types.GenerateContentConfig(temperature=temperature)
    if json_schema:
        config.response_mime_type = "application/json"
        config.response_schema = json_schema
    response = await _get_ai_client().aio.models.generate_content(
        model=GEMINI_MODEL, contents=prompt, config=config
    )
    return response.text or ""


async def _groq(prompt: str, json_schema, temperature: float) -> str:
    kwargs = {}
    if json_schema:
        prompt = _with_json_instructions(prompt, json_schema)
        kwargs["response_format"] = {"type": "json_object"}
    response = await _get_groq_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=temperature,
        **kwargs,
    )
    return response.choices[0].message.content or ""


async def _openrouter(prompt: str, json_schema, temperature: float) -> str:
    body = {
        "models": OPENROUTER_MODELS,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
    }
    if json_schema:
        body["messages"][0]["content"] = _with_json_instructions(prompt, json_schema)
        body["response_format"] = {"type": "json_object"}
    response = await _get_openrouter_client().post("/chat/completions", json=body)
    response.raise_for_status()
    data = response.json()
    logger.info("OpenRouter model: %s", data.get("model"))
    return data["choices"][0]["message"]["content"] or ""


_PROVIDERS = [("gemini", _gemini), ("groq", _groq), ("openrouter", _openrouter)]


async def generate(
    prompt: str,
    *,
    json_schema: Optional[type[T]] = None,
    temperature: float = 0.3,
    timeout: float = LLM_TIMEOUT_S,
) -> str | T:
    """Gemini -> Groq -> OpenRouter. Returns text, or a validated `json_schema` instance.

    A tier fails on exception, `timeout` (per provider), empty output, or (JSON mode) schema validation error.
    """
    errors = []
    for name, call in _PROVIDERS:
        try:
            raw = await asyncio.wait_for(call(prompt, json_schema, temperature), timeout)
            if not raw.strip():
                raise ValueError("empty response")
            result = json_schema.model_validate_json(raw) if json_schema else raw.strip()
            logger.info("LLM served by %s", name)
            return result
        except Exception as exc:
            logger.warning("LLM provider %s failed: %r", name, exc)
            errors.append(f"{name}: {exc!r}")

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"All LLM providers failed: {'; '.join(errors)}",
    )
