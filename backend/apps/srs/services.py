"""Write-side service for reviews: apply one answer (SPEC §6.2, §6.3)."""

from datetime import datetime

from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.srs.engine import CardState, Rating, apply_review
from apps.srs.models import ReviewLog
from apps.vocab.models import UserWord


@transaction.atomic
def apply_review_answer(
    *, user: User, user_word: UserWord, rating: Rating, now: datetime | None = None
) -> UserWord:
    """Run the SM-2 engine, persist the new card state, and append a log.

    `first_reviewed_at` is set exactly once (on the first ever review); it is
    what marks a card as no longer "new", and Again must not reset it.
    """
    now = now or timezone.now()
    result = apply_review(
        CardState(
            ease_factor=user_word.ease_factor,
            interval_days=user_word.interval_days,
            repetitions=user_word.repetitions,
        ),
        rating,
    )

    user_word.ease_factor = result.ease_factor
    user_word.interval_days = result.interval_days
    user_word.repetitions = result.repetitions
    user_word.due_at = now + result.due_offset
    if user_word.first_reviewed_at is None:
        user_word.first_reviewed_at = now
    user_word.last_reviewed_at = now
    user_word.save(
        update_fields=[
            "ease_factor",
            "interval_days",
            "repetitions",
            "due_at",
            "first_reviewed_at",
            "last_reviewed_at",
            "updated_at",
        ]
    )

    ReviewLog.objects.create(
        user=user,
        user_word=user_word,
        rating=rating.value,
        interval_after=result.interval_days,
        ease_after=result.ease_factor,
        reviewed_at=now,
    )
    return user_word
