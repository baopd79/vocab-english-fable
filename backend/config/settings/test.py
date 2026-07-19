"""Settings for pytest — no Redis dependency (CI runs Postgres only).

Throttling is disabled globally so unrelated API tests never trip rate limits
(throttle state would otherwise leak across tests: user PKs repeat between
rollbacks while the throttle cache persists for the whole session). Throttle
tests re-enable it explicitly with @override_settings + a cleared cache.
"""

from config.settings.dev import *  # noqa: F403

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_THROTTLE_CLASSES": [],
    "DEFAULT_THROTTLE_RATES": {"user": None, "enrichment": None, "auth": None, "share": None},
}
