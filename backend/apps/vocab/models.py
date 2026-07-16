"""Vocab models: Deck, the global WordCache and per-user UserWord (SPEC §5)."""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.common.models import TimeStampedModel


class Deck(TimeStampedModel):
    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        # "public" is reserved for the sharing feature on the roadmap.

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="decks"
    )
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=500, blank=True)
    visibility = models.CharField(
        max_length=10, choices=Visibility.choices, default=Visibility.PRIVATE
    )
    is_starter = models.BooleanField(
        default=False,
        help_text="System-curated deck offered to every user for cloning (SPEC §17.2-3).",
    )
    source_deck = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clones",
        help_text="The deck this one was cloned from; also hides already-cloned starters.",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["owner", "name"], name="deck_unique_owner_name"),
        ]

    def __str__(self) -> str:
        return self.name


class WordCache(TimeStampedModel):
    """System-wide enrichment cache, keyed by the normalized word (SPEC §6.1).

    `processing` means an enrichment task has claimed this word and is calling
    the AI provider; the claim is an atomic status transition, never a DB lock.
    A `failed` row is treated as a cache miss and may be re-claimed.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    word = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    part_of_speech = models.CharField(max_length=50, blank=True)
    ipa = models.CharField(max_length=100, blank=True)
    meaning_vi = models.CharField(max_length=500, blank=True)
    example_en = models.CharField(max_length=1000, blank=True)
    example_vi = models.CharField(max_length=1000, blank=True)
    raw_response = models.JSONField(
        null=True, blank=True, help_text="Full provider output, kept for future migrations."
    )
    provider = models.CharField(max_length=50, blank=True)
    model = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name_plural = "word caches"

    def __str__(self) -> str:
        return f"{self.word} ({self.status})"


class UserWord(TimeStampedModel):
    """The user's own editable copy of a word, plus its SM-2 state (SPEC §5).

    Content fields are copied from WordCache on enrichment and freely editable
    afterwards. SRS fields are written only by the review service — read-only
    through the API.
    """

    class EnrichmentStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="user_words"
    )
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="words")
    word_cache = models.ForeignKey(
        WordCache, on_delete=models.SET_NULL, null=True, blank=True, related_name="user_words"
    )
    word_text = models.CharField(max_length=64)
    part_of_speech = models.CharField(max_length=50, blank=True)
    ipa = models.CharField(max_length=100, blank=True)
    meaning_vi = models.CharField(max_length=500, blank=True)
    example_en = models.CharField(max_length=1000, blank=True)
    example_vi = models.CharField(max_length=1000, blank=True)
    enrichment_status = models.CharField(
        max_length=10, choices=EnrichmentStatus.choices, default=EnrichmentStatus.PENDING
    )

    # SM-2 state (SPEC §6.2). "New" is derived from first_reviewed_at IS NULL,
    # never from repetitions — Again resets repetitions to 0.
    ease_factor = models.FloatField(default=2.5, validators=[MinValueValidator(1.3)])
    interval_days = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    repetitions = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    due_at = models.DateTimeField(default=timezone.now)
    first_reviewed_at = models.DateTimeField(null=True, blank=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["deck", "word_text"], name="userword_unique_deck_word_text"
            ),
            models.CheckConstraint(
                condition=models.Q(ease_factor__gte=1.3), name="userword_ease_factor_floor"
            ),
            models.CheckConstraint(
                condition=models.Q(interval_days__gte=0, repetitions__gte=0),
                name="userword_srs_counters_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return self.word_text
