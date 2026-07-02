"""Account models: custom User and per-user study settings."""

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.common.models import TimeStampedModel

from .validators import validate_timezone_name


class User(TimeStampedModel, AbstractUser):
    """Custom user model backed by Google sign-in.

    Declared before the very first migration because switching AUTH_USER_MODEL
    on an already-migrated database is a well-known Django trap.
    """

    email = models.EmailField("email address", unique=True)
    google_sub = models.CharField(
        max_length=255,
        unique=True,
        null=True,
        blank=True,
        help_text="Google subject ID; null for admin-created accounts.",
    )
    display_name = models.CharField(max_length=255, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True)

    def __str__(self) -> str:
        return self.email or self.username


class UserSettings(TimeStampedModel):
    """Per-user study limits and timezone (1-1 with User).

    A value of 0 pauses the corresponding queue (new cards / reviews).
    """

    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="settings")
    new_words_per_day = models.IntegerField(
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    max_reviews_per_day = models.IntegerField(
        default=200,
        validators=[MinValueValidator(0), MaxValueValidator(1000)],
    )
    timezone = models.CharField(
        max_length=64,
        default="Asia/Ho_Chi_Minh",
        validators=[validate_timezone_name],
    )

    class Meta:
        verbose_name_plural = "user settings"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(new_words_per_day__gte=0, new_words_per_day__lte=100),
                name="usersettings_new_words_per_day_range",
            ),
            models.CheckConstraint(
                condition=models.Q(max_reviews_per_day__gte=0, max_reviews_per_day__lte=1000),
                name="usersettings_max_reviews_per_day_range",
            ),
        ]

    def __str__(self) -> str:
        return f"Settings of {self.user}"
