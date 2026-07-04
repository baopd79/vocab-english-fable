"""Provider selection by the AI_PROVIDER env var (SPEC §6.1)."""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from apps.enrichment.providers.base import AIProvider
from apps.enrichment.providers.fake import FakeProvider
from apps.enrichment.providers.gemini import GeminiProvider


def get_provider() -> AIProvider:
    name = settings.AI_PROVIDER
    if name == "gemini":
        return GeminiProvider()
    if name == "fake":
        return FakeProvider()
    raise ImproperlyConfigured(f"Unknown AI_PROVIDER: {name!r} (expected 'gemini' or 'fake')")
