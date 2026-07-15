"""System-wide daily budget for metered AI calls (SPEC §17.2-14, §17.3-Q6).

The Gemini free tier allows ~20 requests/day for the whole system, so every
real provider call spends one slot of a shared daily budget. The counter
lives in the Django cache (Redis in prod) keyed by the date in Google's quota
timezone — quotas reset at midnight Pacific, so our day flips at the same
moment. Losing the counter (Redis restart) can only overspend, which Google
answers with a 429 that the normal failed-as-miss path already absorbs.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

GOOGLE_QUOTA_TZ = ZoneInfo("America/Los_Angeles")
# The key only matters for one Pacific day; keep it a little longer for
# eyeballing in redis-cli, then let it expire on its own.
KEY_TTL_SECONDS = 3 * 24 * 3600


def budget_key(now: datetime | None = None) -> str:
    now = now or timezone.now()
    return f"ai-budget:{now.astimezone(GOOGLE_QUOTA_TZ).date().isoformat()}"


def has_ai_budget(*, now: datetime | None = None) -> bool:
    """Peek without spending — for request-time checks that reject early with
    a friendly error instead of queueing work that is doomed to fail."""
    return cache.get(budget_key(now), 0) < settings.GEMINI_DAILY_BUDGET


def spend_ai_budget(*, now: datetime | None = None) -> bool:
    """Reserve one call slot; False means the budget is exhausted.

    incr-then-compare keeps the check atomic on Redis: two workers racing for
    the last slot can never both get True. Rejected attempts leave the counter
    past the cap, which is harmless — everything is rejected from there on.
    """
    key = budget_key(now)
    cache.add(key, 0, KEY_TTL_SECONDS)
    return cache.incr(key) <= settings.GEMINI_DAILY_BUDGET
