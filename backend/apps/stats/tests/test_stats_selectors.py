"""Stats selectors (SPEC §5, §6.4, §7) with an injected `now` for determinism.

User timezone is Asia/Ho_Chi_Minh (UTC+7). Day bucketing is local, so a review
stored just before UTC midnight can still count as the next local day.
"""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.srs.factories import ReviewLogFactory
from apps.stats import selectors
from apps.vocab.factories import UserWordFactory

pytestmark = pytest.mark.django_db

HCM = "Asia/Ho_Chi_Minh"
TZ = ZoneInfo(HCM)
UTC = ZoneInfo("UTC")
# 2026-07-10 05:00 UTC = 2026-07-10 12:00 local → "today" is 2026-07-10.
NOW = datetime(2026, 7, 10, 5, 0, tzinfo=UTC)


def local(year: int, month: int, day: int, hour: int = 12) -> datetime:
    """A UTC instant corresponding to the given local wall-clock time."""
    return datetime(year, month, day, hour, tzinfo=TZ).astimezone(UTC)


@pytest.fixture
def user():
    user = UserFactory()
    UserSettingsFactory(user=user, timezone=HCM)
    return user


# --- word_state_counts -------------------------------------------------------


def test_word_state_counts_partition(user):
    UserWordFactory(user=user, first_reviewed_at=None, interval_days=0)  # new
    UserWordFactory(user=user, first_reviewed_at=local(2026, 6, 1), interval_days=5)  # learning
    UserWordFactory(user=user, first_reviewed_at=local(2026, 6, 1), interval_days=20)  # learning
    UserWordFactory(user=user, first_reviewed_at=local(2026, 6, 1), interval_days=21)  # mastered
    UserWordFactory(user=user, first_reviewed_at=local(2026, 6, 1), interval_days=60)  # mastered

    assert selectors.word_state_counts(user=user) == (1, 2, 2)


def test_word_state_counts_only_this_user(user):
    UserWordFactory(user=user, first_reviewed_at=None)
    UserWordFactory()  # someone else's word
    assert selectors.word_state_counts(user=user) == (1, 0, 0)


# --- current_streak ----------------------------------------------------------


def streak(user, now=NOW):
    return selectors.current_streak(user=user, now=now, tz=TZ)


def test_streak_consecutive_including_today(user):
    for day in (10, 9, 8):
        ReviewLogFactory(user=user, reviewed_at=local(2026, 7, day))
    assert streak(user) == 3


def test_streak_counts_from_yesterday_when_today_not_reviewed(user):
    for day in (9, 8, 7):  # nothing today (the 10th)
        ReviewLogFactory(user=user, reviewed_at=local(2026, 7, day))
    assert streak(user) == 3


def test_streak_broken_by_a_gap(user):
    ReviewLogFactory(user=user, reviewed_at=local(2026, 7, 10))
    ReviewLogFactory(user=user, reviewed_at=local(2026, 7, 8))  # gap on the 9th
    assert streak(user) == 1


def test_streak_zero_when_neither_today_nor_yesterday(user):
    ReviewLogFactory(user=user, reviewed_at=local(2026, 7, 5))
    assert streak(user) == 0


def test_streak_zero_with_no_reviews(user):
    assert streak(user) == 0


def test_streak_uses_local_day_boundary(user):
    # 2026-07-09 16:00 UTC = 23:00 local July 9; 2026-07-09 17:30 UTC = 00:30 local July 10.
    ReviewLogFactory(user=user, reviewed_at=datetime(2026, 7, 9, 16, 0, tzinfo=UTC))
    ReviewLogFactory(user=user, reviewed_at=datetime(2026, 7, 9, 17, 30, tzinfo=UTC))
    # Locally these are July 9 and July 10 → today + yesterday → streak 2
    # (a naive UTC bucketing would see only July 9 and give 1).
    assert streak(user) == 2


# --- reviews_today -----------------------------------------------------------


def test_reviews_today_counts_distinct_cards(user):
    card = UserWordFactory(user=user)
    for _ in range(3):  # Again pressed 3× on one card today
        ReviewLogFactory(user=user, user_word=card, reviewed_at=local(2026, 7, 10, 9))
    other = UserWordFactory(user=user)
    ReviewLogFactory(user=user, user_word=other, reviewed_at=local(2026, 7, 10, 10))

    assert selectors.reviews_today(user=user, now=NOW, tz=TZ) == 2


def test_reviews_today_respects_local_midnight(user):
    today_card = UserWordFactory(user=user)
    yesterday_card = UserWordFactory(user=user)
    # 00:30 local July 10 → today
    ReviewLogFactory(
        user=user, user_word=today_card, reviewed_at=datetime(2026, 7, 9, 17, 30, tzinfo=UTC)
    )
    # 23:00 local July 9 → not today
    ReviewLogFactory(
        user=user, user_word=yesterday_card, reviewed_at=datetime(2026, 7, 9, 16, 0, tzinfo=UTC)
    )
    assert selectors.reviews_today(user=user, now=NOW, tz=TZ) == 1


# --- daily_reviews -----------------------------------------------------------


def test_daily_reviews_distinct_per_day_zero_filled(user):
    a = UserWordFactory(user=user)
    b = UserWordFactory(user=user)
    c = UserWordFactory(user=user)
    # July 10: cards a (twice) and b → 2 distinct
    ReviewLogFactory(user=user, user_word=a, reviewed_at=local(2026, 7, 10, 8))
    ReviewLogFactory(user=user, user_word=a, reviewed_at=local(2026, 7, 10, 9))
    ReviewLogFactory(user=user, user_word=b, reviewed_at=local(2026, 7, 10, 10))
    # July 8: card c → 1 distinct; July 9: nothing → 0
    ReviewLogFactory(user=user, user_word=c, reviewed_at=local(2026, 7, 8, 12))

    points = selectors.daily_reviews(user=user, days=3, now=NOW)

    assert [(p.date.isoformat(), p.count) for p in points] == [
        ("2026-07-08", 1),
        ("2026-07-09", 0),
        ("2026-07-10", 2),
    ]


def test_daily_reviews_excludes_older_than_window(user):
    card = UserWordFactory(user=user)
    # July 1 is outside the 3-day window ending July 10.
    ReviewLogFactory(user=user, user_word=card, reviewed_at=local(2026, 7, 1))

    points = selectors.daily_reviews(user=user, days=3, now=NOW)

    assert len(points) == 3
    assert all(p.count == 0 for p in points)


# --- review_heatmap -----------------------------------------------------------


def heatmap_counts(user):
    """{iso date: count} for the non-zero heatmap days."""
    points = selectors.review_heatmap(user=user, now=NOW)
    return {p.date.isoformat(): p.count for p in points if p.count}


def test_heatmap_counts_every_review_not_distinct_cards(user):
    card = UserWordFactory(user=user)
    for hour in (8, 9, 10):  # Again pressed 3× on the same card
        ReviewLogFactory(user=user, user_word=card, reviewed_at=local(2026, 7, 10, hour))

    assert heatmap_counts(user) == {"2026-07-10": 3}


def test_heatmap_spans_365_zero_filled_days_ending_today(user):
    points = selectors.review_heatmap(user=user, now=NOW)

    assert len(points) == 365
    assert points[-1].date.isoformat() == "2026-07-10"
    assert points[0].date.isoformat() == "2025-07-11"
    assert all(p.count == 0 for p in points)


def test_heatmap_uses_local_day_boundary(user):
    # 16:00 UTC = 23:00 local July 9; 17:30 UTC = 00:30 local July 10.
    ReviewLogFactory(user=user, reviewed_at=datetime(2026, 7, 9, 16, 0, tzinfo=UTC))
    ReviewLogFactory(user=user, reviewed_at=datetime(2026, 7, 9, 17, 30, tzinfo=UTC))

    assert heatmap_counts(user) == {"2026-07-09": 1, "2026-07-10": 1}


def test_heatmap_counts_reviews_of_deleted_words(user):
    ReviewLogFactory(user=user, user_word=None, reviewed_at=local(2026, 7, 10))

    assert heatmap_counts(user) == {"2026-07-10": 1}


def test_heatmap_excludes_older_than_a_year_and_other_users(user):
    ReviewLogFactory(user=user, reviewed_at=local(2025, 7, 10))  # 366 days before NOW
    ReviewLogFactory(reviewed_at=local(2026, 7, 10))  # someone else's review

    assert heatmap_counts(user) == {}
