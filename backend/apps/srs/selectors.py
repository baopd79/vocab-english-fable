"""Read-side queries for reviews: the daily queue and its quota (SPEC §6.3).

"Today" is measured in the user's timezone even though everything is stored in
UTC, so a review just before local midnight counts toward the right day.
"""

from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.accounts.models import User
from apps.srs.models import ReviewLog
from apps.vocab.models import UserWord


@dataclass(frozen=True)
class ReviewQueue:
    due: list[UserWord]
    new: list[UserWord]


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
        UserWord.objects.filter(
            user=user, first_reviewed_at__isnull=False, due_at__lte=now
        ).order_by("due_at", "id")[:due_limit]
    )
    new = list(
        UserWord.objects.filter(user=user, first_reviewed_at__isnull=True).order_by(
            "created_at", "id"
        )[:new_limit]
    )
    return ReviewQueue(due=due, new=new)
