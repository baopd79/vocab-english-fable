"""SRS persistence: ReviewLog, the append-only record behind stats and streak.

The pure SM-2 algorithm lives in engine.py; this module only stores its output.
"""

from django.conf import settings
from django.db import models

from apps.common.models import TimeStampedModel


class ReviewLog(TimeStampedModel):
    """One answered review. Kept as history: deleting a word or deck nulls
    `user_word` (SET_NULL) but leaves the log so streak/stats never change
    retroactively (SPEC §5, §6.4)."""

    class Rating(models.TextChoices):
        AGAIN = "again", "Again"
        HARD = "hard", "Hard"
        GOOD = "good", "Good"
        EASY = "easy", "Easy"

    class Mode(models.TextChoices):
        """How the review asked the word (SPEC §17.2-10, §17.3-Q1). Modes share
        the word's SM-2 schedule — this is presentation metadata for stats."""

        CLASSIC = "classic", "Classic (typing + flip)"
        MCQ = "mcq", "Multiple choice"
        LISTENING = "listening", "Listening (type what you hear)"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_logs"
    )
    user_word = models.ForeignKey(
        "vocab.UserWord",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="review_logs",
    )
    rating = models.CharField(max_length=10, choices=Rating.choices)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.CLASSIC)
    # SRS state snapshot after applying this review.
    interval_after = models.IntegerField()
    ease_after = models.FloatField()
    reviewed_at = models.DateTimeField()

    class Meta:
        indexes = [
            # Streak/stats and the daily quota both scan a user's logs by time.
            models.Index(fields=["user", "reviewed_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.rating} @ {self.reviewed_at:%Y-%m-%d}"
