"""Pure SM-2 spaced-repetition engine (SPEC §6.2).

No Django imports — this is domain logic only and must stay at 100% test
coverage (it is the source of truth for every user's schedule). The service
layer (Task 15) applies the returned state to a UserWord and turns
`due_offset` into an absolute due datetime.

Interval rounding is ceil (except Again) so a card never gets stuck — e.g.
Hard on a 1-day card gives ceil(1 × 1.2) = 2 days, not 1.
"""

import math
from dataclasses import dataclass
from datetime import timedelta
from enum import Enum

EASE_FLOOR = 1.3
EASY_BONUS = 1.3
# Again keeps the card in the current session rather than scheduling a day out.
AGAIN_DELAY = timedelta(minutes=10)


class Rating(Enum):
    AGAIN = "again"
    HARD = "hard"
    GOOD = "good"
    EASY = "easy"


@dataclass(frozen=True)
class CardState:
    """The SRS fields the algorithm reads. Defaults describe a brand-new card."""

    ease_factor: float = 2.5
    interval_days: int = 0
    repetitions: int = 0


@dataclass(frozen=True)
class ReviewResult:
    """The new SRS state plus how far ahead the card is next due.

    `due_offset` is a timedelta so the engine stays clock-free; the caller adds
    it to the review timestamp.
    """

    ease_factor: float
    interval_days: int
    repetitions: int
    due_offset: timedelta


def apply_review(state: CardState, rating: Rating) -> ReviewResult:
    """Compute the next SRS state for one review (SPEC §6.2, §9)."""
    match rating:
        case Rating.AGAIN:
            return _again(state)
        case Rating.HARD:
            return _hard(state)
        case Rating.GOOD:
            return _good(state)
        case Rating.EASY:
            return _easy(state)


def _again(state: CardState) -> ReviewResult:
    return ReviewResult(
        ease_factor=_floor(state.ease_factor - 0.2),
        interval_days=0,
        repetitions=0,
        due_offset=AGAIN_DELAY,
    )


def _hard(state: CardState) -> ReviewResult:
    interval = 1 if state.repetitions == 0 else math.ceil(state.interval_days * 1.2)
    return _scheduled(_floor(state.ease_factor - 0.15), interval, state.repetitions + 1)


def _good(state: CardState) -> ReviewResult:
    interval = math.ceil(_good_interval(state))
    return _scheduled(state.ease_factor, interval, state.repetitions + 1)


def _easy(state: CardState) -> ReviewResult:
    ease = state.ease_factor + 0.15
    # reps=0 is a fixed 4d (Anki default) so a first Easy is clearly ahead of
    # Good's 1d; otherwise scale Good's real (pre-round) interval by the bonus
    # and ceil once — no compounding rounding.
    interval = 4 if state.repetitions == 0 else math.ceil(_good_interval(state) * EASY_BONUS)
    return _scheduled(ease, interval, state.repetitions + 1)


def _good_interval(state: CardState) -> float:
    """The interval the Good button would give, before rounding — the basis
    for both Good itself and Easy (SPEC §6.2)."""
    if state.repetitions == 0:
        return 1.0
    if state.repetitions == 1:
        return 6.0
    return state.interval_days * state.ease_factor


def _scheduled(ease_factor: float, interval_days: int, repetitions: int) -> ReviewResult:
    return ReviewResult(
        ease_factor=ease_factor,
        interval_days=interval_days,
        repetitions=repetitions,
        due_offset=timedelta(days=interval_days),
    )


def _floor(ease_factor: float) -> float:
    return max(ease_factor, EASE_FLOOR)
