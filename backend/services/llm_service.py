from __future__ import annotations

import json
from typing import Any, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError
import structlog

from config import get_settings
from exceptions import LLMProviderError
from schemas.chat import ChartConfig

logger = structlog.get_logger()
settings = get_settings()

T = TypeVar("T", bound=BaseModel)


class SQLResponse(BaseModel):
    """Structured response expected from the LLM for SQL generation."""

    sql: str = Field(description="The DuckDB compatible SQL query to execute")
    reasoning: str = Field(description="Brief explanation of the chosen query approach")


class FormattedAnswerResponse(BaseModel):
    """Structured response expected from the LLM for the final answer and chart."""

    answer: str = Field(description="The natural language answer to the user's question.")
    suggest_chart: bool = Field(description="Whether a chart would be useful.")
    chart_config: ChartConfig | None = Field(default=None)


class LLMService:
    """Provider-agnostic LLM service.

    Works with any OpenAI-compatible endpoint: OpenAI, Google Gemini,
    Groq, OpenRouter, Ollama. Configured via LLM_BASE_URL + LLM_MODEL
    env vars — no code changes needed to swap providers.

    Uses plain `response_format={"type": "json_object"}` rather than the
    OpenAI-specific `beta.chat.completions.parse` so we stay compatible
    with Gemini + others that implement only the base chat API.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        provider: str = "openai",
    ) -> None:
        self.provider = provider
        self._model = model or settings.LLM_MODEL
        resolved_key = api_key or settings.OPENAI_API_KEY or "DUMMY_KEY"
        resolved_base_url = base_url if base_url is not None else (settings.LLM_BASE_URL or None)

        # OpenRouter accepts (but does not require) these headers for app
        # attribution on their public leaderboard. Harmless elsewhere.
        default_headers: dict[str, str] = {}
        if resolved_base_url and "openrouter.ai" in resolved_base_url:
            default_headers["HTTP-Referer"] = settings.FRONTEND_URL
            default_headers["X-Title"] = settings.APP_NAME

        self.client = AsyncOpenAI(
            api_key=resolved_key,
            base_url=resolved_base_url,
            default_headers=default_headers or None,  # type: ignore[arg-type]
        )

    async def _json_call(
        self,
        system_prompt: str,
        user_prompt: str,
        schema: type[T],
        temperature: float = 0.0,
    ) -> T:
        """Ask the LLM for JSON, validate against `schema`."""
        schema_hint = json.dumps(schema.model_json_schema(), indent=2)
        messages = [
            {
                "role": "system",
                "content": (
                    f"{system_prompt}\n\n"
                    "Respond with a SINGLE JSON object that conforms to this schema "
                    "(no prose, no markdown fences):\n"
                    f"{schema_hint}"
                ),
            },
            {"role": "user", "content": user_prompt},
        ]
        try:
            response = await self.client.chat.completions.create(
                model=self._model,
                messages=messages,  # type: ignore[arg-type]
                response_format={"type": "json_object"},
                temperature=temperature,
            )
        except Exception as exc:
            logger.error("LLM provider error", error=str(exc), provider=self.provider)
            raise LLMProviderError(self.provider, str(exc)) from exc

        raw = response.choices[0].message.content or ""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            # Some providers wrap JSON in fences despite response_format — strip and retry.
            stripped = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            try:
                data = json.loads(stripped)
            except json.JSONDecodeError:
                raise LLMProviderError(
                    self.provider,
                    f"Model did not return valid JSON: {raw[:200]}",
                ) from exc

        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            raise LLMProviderError(
                self.provider,
                f"LLM output failed schema validation: {exc}",
            ) from exc

    async def text_to_sql(
        self,
        question: str,
        schema_context: str,
        dialect: str = "duckdb",
    ) -> SQLResponse:
        """Translate user question into a SQL query."""
        log = logger.bind(question=question, model=self._model)
        log.info("Generating SQL from question")

        system_prompt = f"""
You are a world-class SQL data analyst executing queries against a {dialect} database.
Translate the user's question into a syntactically correct, optimized SQL query.

Rules:
- Ensure compatibility with {dialect} SQL syntax.
- Use the provided schema context.
- SELECT only — no INSERT/UPDATE/DELETE/DROP.
- Use ILIKE/LOWER for case-insensitive text comparisons.
- Wrap table/column names in double quotes if they contain spaces.

Schema Context:
{schema_context}
""".strip()

        parsed = await self._json_call(system_prompt, question, SQLResponse, temperature=0.0)
        log.info("SQL generation successful", predicted_sql=parsed.sql)
        return parsed

    async def format_answer(
        self,
        question: str,
        sql: str,
        data: list[dict[str, Any]],
    ) -> FormattedAnswerResponse:
        """Format raw SQL results into a human-readable response + optional chart config."""
        log = logger.bind(rows_returned=len(data), model=self._model)
        log.info("Formatting LLM answer")

        sample_data = data[:50] if len(data) > 50 else data

        system_prompt = f"""
You are an expert data storyteller. Translate raw database query results into
clear, concise, insightful natural-language answers for business users.

Guidelines:
1. Base the answer ONLY on the data provided.
2. Do NOT mention the SQL query itself.
3. Call out trends, outliers, or obvious summaries when relevant.
4. If a chart would help, set suggest_chart=true and fill chart_config.
   Valid chart_type values: bar, line, pie, scatter.
   x_axis / y_axis MUST be column names that appear in the data sample.

Context:
- User question: "{question}"
- Executed SQL: {sql}
- Total rows: {len(data)}
- Data sample (up to 50 rows): {json.dumps(sample_data, default=str)}
""".strip()

        parsed = await self._json_call(
            system_prompt,
            "Produce the JSON response now.",
            FormattedAnswerResponse,
            temperature=0.4,
        )
        log.info("Answer formatting successful")
        return parsed
