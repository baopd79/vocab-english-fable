"""Read-side stats (SPEC §6.4, §7). All "day" bucketing is done in the user's
timezone even though ReviewLog.reviewed_at is stored UTC.

Word/review counts use *distinct cards* per day; the streak counts a day when it
has at least one review of any kind.
"""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.accounts.models import User
from apps.srs.models import ReviewLog
from apps.vocab.models import UserWord

MASTERED_INTERVAL_DAYS = 21  # SPEC §5: interval ≥ 21 days = "mastered"


@dataclass(frozen=True)
class StatsOverview:
    new: int
    learning: int
    mastered: int
    streak: int
    reviewed_today: int


@dataclass(frozen=True)
class DailyPoint:
    date: date
    count: int


def _local_date(dt: datetime, tz: ZoneInfo) -> date:
    return dt.astimezone(tz).date()


def _local_midnight_utc(day: date, tz: ZoneInfo) -> datetime:
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(ZoneInfo("UTC"))


def word_state_counts(*, user: User) -> tuple[int, int, int]:
    """(new, learning, mastered) — a partition of the user's words (SPEC §5).

    new = never reviewed; learning = reviewed and interval < 21d;
    mastered = interval ≥ 21d (only reviewed cards ever reach a non-zero interval).
    """
    words = UserWord.objects.filter(user=user)
    new = words.filter(first_reviewed_at__isnull=True).count()
    learning = words.filter(
        first_reviewed_at__isnull=False, interval_days__lt=MASTERED_INTERVAL_DAYS
    ).count()
    mastered = words.filter(interval_days__gte=MASTERED_INTERVAL_DAYS).count()
    return new, learning, mastered


def reviews_today(*, user: User, now: datetime, tz: ZoneInfo) -> int:
    """Distinct cards reviewed today (Again on one card counts once)."""
    day_start = _local_midnight_utc(now.astimezone(tz).date(), tz)
    return (
        ReviewLog.objects.filter(
            user=user, reviewed_at__gte=day_start, user_word__isnull=False
        )
        .values("user_word")
        .distinct()
        .count()
    )


def current_streak(*, user: User, now: datetime, tz: ZoneInfo) -> int:
    """Consecutive days (up to today, or yesterday if today has no review yet)
    with at least one ReviewLog — SPEC §6.4."""
    days_with_reviews = {
        _local_date(dt, tz)
        for dt in ReviewLog.objects.filter(user=user).values_list("reviewed_at", flat=True)
    }
    if not days_with_reviews:
        return 0

    today = now.astimezone(tz).date()
    if today in days_with_reviews:
        cursor = today
    elif (today - timedelta(days=1)) in days_with_reviews:
        cursor = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in days_with_reviews:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def overview(*, user: User, now: datetime | None = None) -> StatsOverview:
    now = now or timezone.now()
    tz = ZoneInfo(user.settings.timezone)
    new, learning, mastered = word_state_counts(user=user)
    return StatsOverview(
        new=new,
        learning=learning,
        mastered=mastered,
        streak=current_streak(user=user, now=now, tz=tz),
        reviewed_today=reviews_today(user=user, now=now, tz=tz),
    )


def daily_reviews(*, user: User, days: int, now: datetime | None = None) -> list[DailyPoint]:
    """Distinct cards reviewed per local day over the last `days` days, oldest
    first, with zero-filled gaps so the chart has a continuous x-axis."""
    now = now or timezone.now()
    tz = ZoneInfo(user.settings.timezone)
    today = now.astimezone(tz).date()
    start_day = today - timedelta(days=days - 1)
    start_utc = _local_midnight_utc(start_day, tz)

    cards_by_day: dict[date, set[int]] = defaultdict(set)
    for reviewed_at, user_word_id in ReviewLog.objects.filter(
        user=user, reviewed_at__gte=start_utc, user_word__isnull=False
    ).values_list("reviewed_at", "user_word"):
        cards_by_day[_local_date(reviewed_at, tz)].add(user_word_id)

    points = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        points.append(DailyPoint(date=day, count=len(cards_by_day.get(day, ()))))
    return points
