"""Gemini provider — structured JSON output validated with pydantic.

The response schema is passed to the API to steer generation, but the trust
boundary is our own `WordEnrichmentSchema` validation on the raw text: model
output is untrusted regardless of what the API promises (SPEC §9).
"""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from google import genai
from google.genai import errors as genai_errors
from pydantic import ValidationError

from apps.enrichment.providers.base import EnrichmentError, WordEnrichment
from apps.enrichment.providers.schema import (
    MAX_EXAMPLE,
    MAX_IPA,
    MAX_MEANING_VI,
    MAX_PART_OF_SPEECH,
    WordEnrichmentSchema,
)

REQUEST_TIMEOUT_MS = 30_000

PROMPT_TEMPLATE = f"""\
You are an English-Vietnamese dictionary assistant for Vietnamese learners.
For the English word "{{word}}", return JSON with exactly these fields:
- part_of_speech: its main part of speech, lowercase English (e.g. "noun"), \
max {MAX_PART_OF_SPEECH} characters
- ipa: IPA transcription wrapped in slashes (e.g. "/həˈloʊ/"), max {MAX_IPA} characters
- meaning_vi: concise Vietnamese meaning(s), max {MAX_MEANING_VI} characters
- example_en: one natural English example sentence using the word, max {MAX_EXAMPLE} characters
- example_vi: Vietnamese translation of that example, max {MAX_EXAMPLE} characters
Plain text only in every field — no markdown, no HTML."""


class GeminiProvider:
    name = "gemini"

    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self.model = model if model is not None else settings.GEMINI_MODEL
        if not self._api_key:
            raise ImproperlyConfigured("GEMINI_API_KEY is not set")
        self._client = genai.Client(
            api_key=self._api_key,
            http_options={"timeout": REQUEST_TIMEOUT_MS},
        )

    def enrich_word(self, word: str) -> WordEnrichment:
        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=PROMPT_TEMPLATE.format(word=word),
                config={
                    "response_mime_type": "application/json",
                    "response_schema": WordEnrichmentSchema,
                    "temperature": 0.2,
                },
            )
        except genai_errors.APIError as exc:
            raise EnrichmentError(f"Gemini API error for {word!r}: {exc}") from exc

        raw = response.text
        if not raw:
            raise EnrichmentError(f"Gemini returned an empty response for {word!r}")
        try:
            validated = WordEnrichmentSchema.model_validate_json(raw)
        except ValidationError as exc:
            raise EnrichmentError(f"Gemini response failed validation for {word!r}: {exc}") from exc
        return WordEnrichment(**validated.model_dump())
