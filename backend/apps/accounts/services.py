"""Write-side services for the accounts app."""

from django.db import transaction

from .models import User, UserSettings


@transaction.atomic
def create_user_settings(*, user: User) -> UserSettings:
    """Ensure the user has a settings row, creating it with defaults.

    Idempotent (get_or_create) — the auth service calls this on every login so
    existing users are backfilled if the row is ever missing.
    """
    user_settings, _ = UserSettings.objects.get_or_create(user=user)
    return user_settings
