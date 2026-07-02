from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Custom user model.

    Declared before the very first migration because switching AUTH_USER_MODEL
    on an already-migrated database is a well-known Django trap. Google OAuth
    fields (google_sub, display_name, avatar_url) arrive in the accounts task.
    """
