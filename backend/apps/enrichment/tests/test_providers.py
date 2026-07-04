"""Provider unit tests — no network, no DB; the Gemini client is mocked."""

import json
from types import SimpleNamespace
from unittest import mock

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings
from google.genai import errors as genai_errors

from apps.enrichment.providers import EnrichmentError, WordEnrichment, get_provider
from apps.enrichment.providers.fake import FakeProvider
from apps.enrichment.providers.gemini import GeminiProvider
from apps.enrichment.providers.schema import (
    MAX_EXAMPLE,
    MAX_IPA,
    MAX_MEANING_VI,
    MAX_PART_OF_SPEECH,
)

VALID_PAYLOAD = {
    "part_of_speech": "noun",
    "ipa": "/həˈloʊ/",
    "meaning_vi": "lời chào",
    "example_en": "She said hello to everyone in the room.",
    "example_vi": "Cô ấy chào mọi người trong phòng.",
}


def gemini_with_response(text: str | None) -> GeminiProvider:
    """Build a GeminiProvider whose client returns a canned response."""
    with mock.patch("apps.enrichment.providers.gemini.genai.Client") as client_cls:
        provider = GeminiProvider(api_key="test-key", model="test-model")
    client_cls.return_value.models.generate_content.return_value = SimpleNamespace(text=text)
    return provider


# --- factory ---------------------------------------------------------------


@override_settings(AI_PROVIDER="fake")
def test_factory_returns_fake_provider():
    assert isinstance(get_provider(), FakeProvider)


@override_settings(AI_PROVIDER="gemini", GEMINI_API_KEY="test-key")
def test_factory_returns_gemini_provider():
    with mock.patch("apps.enrichment.providers.gemini.genai.Client"):
        assert isinstance(get_provider(), GeminiProvider)


@override_settings(AI_PROVIDER="openai")
def test_factory_rejects_unknown_provider():
    with pytest.raises(ImproperlyConfigured, match="openai"):
        get_provider()


@override_settings(AI_PROVIDER="gemini", GEMINI_API_KEY="")
def test_gemini_requires_api_key():
    with pytest.raises(ImproperlyConfigured, match="GEMINI_API_KEY"):
        get_provider()


# --- FakeProvider ----------------------------------------------------------


def test_fake_provider_needs_no_key_and_is_deterministic():
    provider = FakeProvider()
    first = provider.enrich_word("hello")
    assert first == provider.enrich_word("hello")
    assert isinstance(first, WordEnrichment)
    assert "hello" in first.example_en
    assert first.part_of_speech and first.ipa and first.meaning_vi and first.example_vi


def test_fake_provider_output_respects_length_limits():
    result = FakeProvider().enrich_word("a" * 64)  # longest normalized word
    assert len(result.part_of_speech) <= MAX_PART_OF_SPEECH
    assert len(result.ipa) <= MAX_IPA
    assert len(result.meaning_vi) <= MAX_MEANING_VI
    assert len(result.example_en) <= MAX_EXAMPLE
    assert len(result.example_vi) <= MAX_EXAMPLE


# --- GeminiProvider --------------------------------------------------------


def test_gemini_parses_valid_response():
    provider = gemini_with_response(json.dumps(VALID_PAYLOAD))
    result = provider.enrich_word("hello")
    assert result == WordEnrichment(**VALID_PAYLOAD)


def test_gemini_rejects_missing_field():
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "meaning_vi"}
    provider = gemini_with_response(json.dumps(payload))
    with pytest.raises(EnrichmentError, match="meaning_vi"):
        provider.enrich_word("hello")


@pytest.mark.parametrize(
    ("field", "limit"),
    [
        ("part_of_speech", MAX_PART_OF_SPEECH),
        ("ipa", MAX_IPA),
        ("meaning_vi", MAX_MEANING_VI),
        ("example_en", MAX_EXAMPLE),
        ("example_vi", MAX_EXAMPLE),
    ],
)
def test_gemini_rejects_over_length_field(field: str, limit: int):
    payload = {**VALID_PAYLOAD, field: "x" * (limit + 1)}
    provider = gemini_with_response(json.dumps(payload))
    with pytest.raises(EnrichmentError, match=field):
        provider.enrich_word("hello")


def test_gemini_rejects_whitespace_only_field():
    payload = {**VALID_PAYLOAD, "ipa": "   "}
    provider = gemini_with_response(json.dumps(payload))
    with pytest.raises(EnrichmentError, match="ipa"):
        provider.enrich_word("hello")


def test_gemini_rejects_non_json_response():
    provider = gemini_with_response("Sorry, I cannot help with that.")
    with pytest.raises(EnrichmentError):
        provider.enrich_word("hello")


def test_gemini_rejects_empty_response():
    provider = gemini_with_response(None)
    with pytest.raises(EnrichmentError, match="empty"):
        provider.enrich_word("hello")


def test_gemini_wraps_api_error():
    provider = gemini_with_response(None)
    generate = provider._client.models.generate_content  # type: ignore[attr-defined]
    generate.side_effect = genai_errors.APIError(429, {"error": {"message": "quota"}})
    with pytest.raises(EnrichmentError, match="API error"):
        provider.enrich_word("hello")


def test_gemini_strips_whitespace_around_values():
    payload = {**VALID_PAYLOAD, "ipa": "  /həˈloʊ/  "}
    provider = gemini_with_response(json.dumps(payload))
    assert provider.enrich_word("hello").ipa == "/həˈloʊ/"
