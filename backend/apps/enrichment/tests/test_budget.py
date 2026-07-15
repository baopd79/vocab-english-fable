"""Daily AI budget (SPEC §17.2-14, §17.3-Q6) — a cache counter keyed by
Google's quota day, which resets at midnight Pacific."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from django.core.cache import cache
from django.test import override_settings

from apps.enrichment.budget import budget_key, has_ai_budget, spend_ai_budget


@pytest.fixture(autouse=True)
def fresh_counter():
    cache.clear()
    yield
    cache.clear()


@override_settings(GEMINI_DAILY_BUDGET=2)
def test_spend_until_cap_then_reject():
    assert has_ai_budget() is True
    assert spend_ai_budget() is True
    assert spend_ai_budget() is True

    assert has_ai_budget() is False
    assert spend_ai_budget() is False


@override_settings(GEMINI_DAILY_BUDGET=0)
def test_zero_budget_rejects_from_the_start():
    assert has_ai_budget() is False
    assert spend_ai_budget() is False


def test_budget_day_flips_at_pacific_midnight():
    # July = PDT (UTC-7): midnight Pacific is 07:00 UTC.
    before = datetime(2026, 7, 14, 6, 59, tzinfo=ZoneInfo("UTC"))
    after = datetime(2026, 7, 14, 7, 1, tzinfo=ZoneInfo("UTC"))
    assert budget_key(before) == "ai-budget:2026-07-13"
    assert budget_key(after) == "ai-budget:2026-07-14"


@override_settings(GEMINI_DAILY_BUDGET=1)
def test_new_pacific_day_starts_with_a_fresh_budget():
    late_yesterday = datetime(2026, 7, 14, 6, 0, tzinfo=ZoneInfo("UTC"))
    early_today = datetime(2026, 7, 14, 8, 0, tzinfo=ZoneInfo("UTC"))

    assert spend_ai_budget(now=late_yesterday) is True
    assert spend_ai_budget(now=late_yesterday) is False
    assert spend_ai_budget(now=early_today) is True  # new day, new counter
