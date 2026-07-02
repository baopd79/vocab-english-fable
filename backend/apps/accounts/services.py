"""Write-side services for the accounts app."""

from django.conf import settings
from django.db import transaction
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .exceptions import InvalidGoogleToken
from .models import User, UserSettings


@transaction.atomic
def create_user_settings(*, user: User) -> UserSettings:
    """Ensure the user has a settings row, creating it with defaults.

    Idempotent (get_or_create) — the auth service calls this on every login so
    existing users are backfilled if the row is ever missing.
    """
    user_settings, _ = UserSettings.objects.get_or_create(user=user)
    return user_settings


@transaction.atomic
def authenticate_google_user(*, credential: str) -> User:
    """Verify a Google ID token and return the matching user, creating it on first login.

    Identity comes exclusively from the verified token, never from the request
    body (SPEC §9). Lookup key is the immutable `sub`; email and profile fields
    are refreshed on every login because they can change on the Google side.
    """
    try:
        claims = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            audience=settings.GOOGLE_OAUTH_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except ValueError as exc:
        raise InvalidGoogleToken from exc

    email = claims.get("email", "")
    if not email or not claims.get("email_verified"):
        raise InvalidGoogleToken("Google account has no verified email.")

    profile = {
        "email": email,
        "display_name": claims.get("name", ""),
        "avatar_url": claims.get("picture", ""),
    }
    user, created = User.objects.get_or_create(
        google_sub=claims["sub"],
        defaults={"username": email, **profile},
    )
    if not created:
        changed = [field for field, value in profile.items() if getattr(user, field) != value]
        if changed:
            for field in changed:
                setattr(user, field, profile[field])
            user.save(update_fields=changed)

    create_user_settings(user=user)
    return user
