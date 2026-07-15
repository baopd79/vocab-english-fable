"""Provider selection by the AI_PROVIDER env var (SPEC §6.1)."""

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from apps.enrichment.providers.base import AIProvider
from apps.enrichment.providers.fake import FakeProvider
from apps.enrichment.providers.gemini import GeminiProvider

METERED_PROVIDERS = {"gemini"}


def get_provider() -> AIProvider:
    name = settings.AI_PROVIDER
    if name == "gemini":
        return GeminiProvider()
    if name == "fake":
        return FakeProvider()
    raise ImproperlyConfigured(f"Unknown AI_PROVIDER: {name!r} (expected 'gemini' or 'fake')")


def provider_is_metered() -> bool:
    """Whether the configured provider spends the daily budget — answerable
    from settings alone, so request-time checks never pay for building a
    provider client (GeminiProvider spins up an HTTP client on init)."""
    return settings.AI_PROVIDER in METERED_PROVIDERS
