"""Golden-table tests for the SM-2 engine (SPEC §6.2). Pure functions, no DB.

Table covers all 4 ratings across new / reps=1 / reps>1, plus the two edges
called out in the spec (Hard 1d→2d, Easy new→4d), the single-ceil Easy case,
and the EF floor.
"""

from datetime import timedelta

import pytest

from apps.srs.engine import (
    AGAIN_DELAY,
    CardState,
    Rating,
    ReviewResult,
    apply_review,
)

NEW = CardState(ease_factor=2.5, interval_days=0, repetitions=0)
REPS1 = CardState(ease_factor=2.5, interval_days=1, repetitions=1)
REPS2 = CardState(ease_factor=2.5, interval_days=6, repetitions=2)

DAY = timedelta(days=1)

# (id, state, rating, expected_ef, expected_interval_days, expected_reps, expected_due_offset)
CASES = [
    # --- new card (reps=0) ---
    ("new-again", NEW, Rating.AGAIN, 2.3, 0, 0, AGAIN_DELAY),
    ("new-hard", NEW, Rating.HARD, 2.35, 1, 1, 1 * DAY),
    ("new-good", NEW, Rating.GOOD, 2.5, 1, 1, 1 * DAY),
    ("new-easy", NEW, Rating.EASY, 2.65, 4, 1, 4 * DAY),  # SPEC edge: Easy new → 4d
    # --- reps=1 card (interval 1d) ---
    ("reps1-again", REPS1, Rating.AGAIN, 2.3, 0, 0, AGAIN_DELAY),
    ("reps1-hard", REPS1, Rating.HARD, 2.35, 2, 2, 2 * DAY),  # SPEC edge: Hard 1d → 2d
    ("reps1-good", REPS1, Rating.GOOD, 2.5, 6, 2, 6 * DAY),
    ("reps1-easy", REPS1, Rating.EASY, 2.65, 8, 2, 8 * DAY),  # ceil(6 × 1.3) = 8
    # --- reps>1 card (interval 6d) ---
    ("reps2-again", REPS2, Rating.AGAIN, 2.3, 0, 0, AGAIN_DELAY),
    ("reps2-hard", REPS2, Rating.HARD, 2.35, 8, 3, 8 * DAY),  # ceil(6 × 1.2) = 8
    ("reps2-good", REPS2, Rating.GOOD, 2.5, 15, 3, 15 * DAY),  # ceil(6 × 2.5) = 15
    ("reps2-easy", REPS2, Rating.EASY, 2.65, 20, 3, 20 * DAY),  # ceil(6 × 2.5 × 1.3) = 20
    # --- single-ceil lock (interval=3, EF=2.36, reps=2) ---
    ("single-ceil-good", CardState(2.36, 3, 2), Rating.GOOD, 2.36, 8, 3, 8 * DAY),
    ("single-ceil-easy", CardState(2.36, 3, 2), Rating.EASY, 2.51, 10, 3, 10 * DAY),
    # --- EF floor 1.3 ---
    ("floor-again", CardState(1.4, 6, 2), Rating.AGAIN, 1.3, 0, 0, AGAIN_DELAY),
    ("floor-hard", CardState(1.4, 6, 2), Rating.HARD, 1.3, 8, 3, 8 * DAY),
    ("floor-again-at-floor", CardState(1.3, 6, 2), Rating.AGAIN, 1.3, 0, 0, AGAIN_DELAY),
]


@pytest.mark.parametrize(
    ("state", "rating", "ef", "interval", "reps", "due"),
    [c[1:] for c in CASES],
    ids=[c[0] for c in CASES],
)
def test_apply_review(
    state: CardState,
    rating: Rating,
    ef: float,
    interval: int,
    reps: int,
    due: timedelta,
):
    result = apply_review(state, rating)
    assert isinstance(result, ReviewResult)
    assert result.ease_factor == pytest.approx(ef)
    assert result.interval_days == interval
    assert result.repetitions == reps
    assert result.due_offset == due


def test_again_never_drops_ease_below_floor():
    result = apply_review(CardState(1.3, 10, 5), Rating.AGAIN)
    assert result.ease_factor == pytest.approx(1.3)


def test_easy_ef_has_no_ceiling():
    # Easy always adds 0.15 to EF regardless of how high it already is.
    result = apply_review(CardState(3.0, 6, 2), Rating.EASY)
    assert result.ease_factor == pytest.approx(3.15)


def test_input_state_is_not_mutated():
    state = CardState(2.5, 6, 2)
    apply_review(state, Rating.GOOD)
    assert state == CardState(2.5, 6, 2)


def test_rating_values_match_api_contract():
    # The API/serializer maps request strings onto these enum values (SPEC §7).
    assert {r.value for r in Rating} == {"again", "hard", "good", "easy"}
