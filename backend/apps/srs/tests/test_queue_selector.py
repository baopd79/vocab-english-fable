"""Review-queue quota logic (SPEC §6.3) with an injected `now` so the day
boundary is deterministic — no freezegun dependency.

All times are UTC; the user's timezone is Asia/Ho_Chi_Minh (UTC+7). For
now = 2026-07-02 05:00 UTC (12:00 local), local midnight today is
2026-07-01 17:00 UTC — the cutoff between "yesterday" and "today".
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.srs.factories import ReviewLogFactory
from apps.srs.selectors import build_review_queue, user_day_start
from apps.vocab.factories import DeckFactory, UserWordFactory

pytestmark = pytest.mark.django_db

HCM = "Asia/Ho_Chi_Minh"
NOW = datetime(2026, 7, 2, 5, 0, tzinfo=ZoneInfo("UTC"))
DAY_START = datetime(2026, 7, 1, 17, 0, tzinfo=ZoneInfo("UTC"))


def make_user(*, new_per_day: int, max_reviews: int):
    user = UserFactory()
    UserSettingsFactory(
        user=user,
        new_words_per_day=new_per_day,
        max_reviews_per_day=max_reviews,
        timezone=HCM,
    )
    return user


def due_card(user, deck, **kwargs):
    kwargs.setdefault("first_reviewed_at", DAY_START - timedelta(days=5))
    kwargs.setdefault("due_at", NOW - timedelta(hours=1))
    return UserWordFactory(user=user, deck=deck, **kwargs)


def test_user_day_start_uses_user_timezone():
    assert user_day_start(tz_name=HCM, now=NOW) == DAY_START


def test_due_first_then_new_ordering():
    user = make_user(new_per_day=10, max_reviews=10)
    deck = DeckFactory(owner=user)
    older = due_card(user, deck, due_at=NOW - timedelta(hours=3))
    newer = due_card(user, deck, due_at=NOW - timedelta(hours=1))
    fresh = UserWordFactory(user=user, deck=deck, first_reviewed_at=None)

    queue = build_review_queue(user=user, now=NOW)

    assert [c.id for c in queue.due] == [older.id, newer.id]  # oldest due first
    assert [c.id for c in queue.new] == [fresh.id]


def test_again_multiple_times_costs_one_review_slot():
    user = make_user(new_per_day=0, max_reviews=3)
    deck = DeckFactory(owner=user)
    cards = [due_card(user, deck) for _ in range(3)]
    # Same card logged twice today (an Again press) — must count as 1, not 2.
    ReviewLogFactory(user=user, user_word=cards[0], reviewed_at=DAY_START + timedelta(hours=1))
    ReviewLogFactory(user=user, user_word=cards[0], reviewed_at=DAY_START + timedelta(hours=2))

    queue = build_review_queue(user=user, now=NOW)

    # limit = 3 - 1 distinct card = 2 (would be 1 if it counted raw log rows).
    assert len(queue.due) == 2


def test_review_just_before_local_midnight_does_not_consume_today_quota():
    user = make_user(new_per_day=0, max_reviews=1)
    deck = DeckFactory(owner=user)
    card = due_card(user, deck)
    # 2026-07-01 16:00 UTC = 23:00 local July 1 → yesterday.
    ReviewLogFactory(
        user=user, user_word=card, reviewed_at=datetime(2026, 7, 1, 16, 0, tzinfo=ZoneInfo("UTC"))
    )

    queue = build_review_queue(user=user, now=NOW)

    assert len(queue.due) == 1  # yesterday's review left today's single slot free


def test_review_just_after_local_midnight_consumes_today_quota():
    user = make_user(new_per_day=0, max_reviews=1)
    deck = DeckFactory(owner=user)
    card = due_card(user, deck)
    # 2026-07-01 17:30 UTC = 00:30 local July 2 → today.
    ReviewLogFactory(
        user=user, user_word=card, reviewed_at=datetime(2026, 7, 1, 17, 30, tzinfo=ZoneInfo("UTC"))
    )

    queue = build_review_queue(user=user, now=NOW)

    assert len(queue.due) == 0  # today's review used up the single slot


def test_new_quota_counts_cards_first_reviewed_today():
    user = make_user(new_per_day=3, max_reviews=0)
    deck = DeckFactory(owner=user)
    UserWordFactory(user=user, deck=deck, first_reviewed_at=DAY_START + timedelta(hours=1))
    for _ in range(5):
        UserWordFactory(user=user, deck=deck, first_reviewed_at=None)

    queue = build_review_queue(user=user, now=NOW)

    assert len(queue.new) == 2  # limit = 3 - 1 started today = 2


def test_new_card_due_in_past_is_not_in_due_group():
    user = make_user(new_per_day=10, max_reviews=10)
    deck = DeckFactory(owner=user)
    fresh = UserWordFactory(
        user=user, deck=deck, first_reviewed_at=None, due_at=NOW - timedelta(hours=1)
    )

    queue = build_review_queue(user=user, now=NOW)

    assert fresh.id in [c.id for c in queue.new]
    assert fresh.id not in [c.id for c in queue.due]


def test_zero_quota_returns_empty_groups():
    user = make_user(new_per_day=0, max_reviews=0)
    deck = DeckFactory(owner=user)
    due_card(user, deck)
    UserWordFactory(user=user, deck=deck, first_reviewed_at=None)

    queue = build_review_queue(user=user, now=NOW)

    assert queue.due == []
    assert queue.new == []


def test_future_due_card_is_not_returned():
    user = make_user(new_per_day=0, max_reviews=10)
    deck = DeckFactory(owner=user)
    due_card(user, deck, due_at=NOW + timedelta(days=1))

    queue = build_review_queue(user=user, now=NOW)

    assert queue.due == []


def test_queue_only_includes_the_requested_user():
    user = make_user(new_per_day=10, max_reviews=10)
    deck = DeckFactory(owner=user)
    mine = due_card(user, deck)
    due_card(UserFactory(), DeckFactory())  # someone else's due card

    queue = build_review_queue(user=user, now=NOW)

    assert [c.id for c in queue.due] == [mine.id]


def test_build_queue_defaults_now_to_current_time():
    user = make_user(new_per_day=10, max_reviews=10)
    deck = DeckFactory(owner=user)
    from django.utils import timezone

    due_card(user, deck, due_at=timezone.now() - timedelta(hours=1))

    queue = build_review_queue(user=user)  # now omitted → timezone.now()

    assert len(queue.due) == 1
