"""Read-side queries for reviews: the daily queue and its quota (SPEC §6.3).

"Today" is measured in the user's timezone even though everything is stored in
UTC, so a review just before local midnight counts toward the right day.
"""

import random
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.accounts.models import User
from apps.srs.models import ReviewLog
from apps.vocab.models import UserWord

# Review modes (SPEC §17.2-10, §17.3-Q1) share the word's SM-2 schedule — the
# mode only decides how this review asks the word. Young cards (reps < 2)
# always drill the classic form; from rep 2 the mode cycles deterministically.
MIN_REPS_FOR_NEW_MODES = 2
MODE_CYCLE = {
    0: ReviewLog.Mode.MCQ,
    1: ReviewLog.Mode.LISTENING,
    2: ReviewLog.Mode.CLASSIC,
}
MCQ_DISTRACTORS = 3


@dataclass(frozen=True)
class DeckQueueCount:
    """Per-deck slice of today's queue, for the pre-review overview (§17.1-B3)."""

    deck_id: int
    deck_name: str
    due_count: int
    new_count: int


@dataclass(frozen=True)
class ReviewQueue:
    due: list[UserWord]
    new: list[UserWord]
    decks: list[DeckQueueCount]


def user_day_start(*, tz_name: str, now: datetime) -> datetime:
    """The UTC instant of the most recent local midnight for the user."""
    local_now = now.astimezone(ZoneInfo(tz_name))
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight.astimezone(ZoneInfo("UTC"))


def build_review_queue(*, user: User, now: datetime | None = None) -> ReviewQueue:
    """Due cards first (oldest due), then new cards, each capped by remaining
    daily quota. New cards are excluded from the due group so they are never
    counted twice (SPEC §6.3)."""
    now = now or timezone.now()
    settings = user.settings
    day_start = user_day_start(tz_name=settings.timezone, now=now)

    # Again pressed repeatedly on one card costs a single review slot, so count
    # *distinct* cards logged today, not raw log rows.
    reviews_done = (
        ReviewLog.objects.filter(user=user, reviewed_at__gte=day_start, user_word__isnull=False)
        .values("user_word")
        .distinct()
        .count()
    )
    new_done = UserWord.objects.filter(user=user, first_reviewed_at__gte=day_start).count()

    due_limit = max(0, settings.max_reviews_per_day - reviews_done)
    new_limit = max(0, settings.new_words_per_day - new_done)

    due = list(
        UserWord.objects.filter(user=user, first_reviewed_at__isnull=False, due_at__lte=now)
        .select_related("deck")
        .order_by("due_at", "id")[:due_limit]
    )
    new = list(
        UserWord.objects.filter(user=user, first_reviewed_at__isnull=True)
        .select_related("deck")
        .order_by("created_at", "id")[:new_limit]
    )
    _assign_modes(user=user, cards=[*due, *new])
    return ReviewQueue(due=due, new=new, decks=_deck_breakdown(due, new))


def review_mode(card: UserWord) -> str:
    """Which form this review of the card takes (deterministic, SPEC §17.3-Q1):
    new + young cards stay classic; from rep 2 cycle by repetitions % 3
    (rep 2 → classic, 3 → MCQ, 4 → listening, 5 → classic, …)."""
    if card.first_reviewed_at is None or card.repetitions < MIN_REPS_FOR_NEW_MODES:
        return ReviewLog.Mode.CLASSIC
    return MODE_CYCLE[card.repetitions % 3]


def _assign_modes(*, user: User, cards: list[UserWord]) -> None:
    """Annotate each queue card in place with `review_mode` and `mcq_choices`
    (4 shuffled VI meanings for MCQ, None otherwise). An MCQ card without
    enough distractors falls back to classic so the client never renders a
    half-empty question."""
    meaning_pool: list[str] | None = None  # lazy: only queried when MCQ shows up
    for card in cards:
        mode = review_mode(card)
        choices = None
        if mode == ReviewLog.Mode.MCQ:
            if meaning_pool is None:
                meaning_pool = _mcq_meaning_pool(user=user)
            choices = _mcq_choices(card, meaning_pool)
            if choices is None:
                mode = ReviewLog.Mode.CLASSIC
        card.review_mode = mode
        card.mcq_choices = choices


def _mcq_meaning_pool(*, user: User) -> list[str]:
    """Distinct VI meanings across the user's enriched words — the distractor
    candidates for every MCQ card in this queue (one query, reused)."""
    return list(
        UserWord.objects.filter(user=user, enrichment_status="completed")
        .exclude(meaning_vi="")
        .values_list("meaning_vi", flat=True)
        .distinct()
    )


def _mcq_choices(card: UserWord, meaning_pool: list[str]) -> list[str] | None:
    """4 shuffled options: the card's meaning + 3 random distractors, or None
    when the pool can't supply 3 (the caller falls back to classic)."""
    candidates = [meaning for meaning in meaning_pool if meaning != card.meaning_vi]
    if len(candidates) < MCQ_DISTRACTORS or not card.meaning_vi:
        return None
    choices = [card.meaning_vi, *random.sample(candidates, MCQ_DISTRACTORS)]
    random.shuffle(choices)
    return choices


def _deck_breakdown(due: list[UserWord], new: list[UserWord]) -> list[DeckQueueCount]:
    """Counts derive from the already-capped queue, so they always add up to
    exactly what the session will show. Biggest decks first, ties by name."""
    due_counts = Counter(card.deck_id for card in due)
    new_counts = Counter(card.deck_id for card in new)
    names = {card.deck_id: card.deck.name for card in [*due, *new]}
    return [
        DeckQueueCount(
            deck_id=deck_id,
            deck_name=names[deck_id],
            due_count=due_counts[deck_id],
            new_count=new_counts[deck_id],
        )
        for deck_id in sorted(
            names, key=lambda d: (-(due_counts[d] + new_counts[d]), names[d].lower())
        )
    ]
