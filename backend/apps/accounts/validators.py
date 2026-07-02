"""Field validators for account models."""

from functools import lru_cache
from zoneinfo import available_timezones

from django.core.exceptions import ValidationError


@lru_cache(maxsize=1)
def _canonical_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def validate_timezone_name(value: str) -> None:
    """Reject values that are not canonical IANA timezone names.

    Checks membership in available_timezones() instead of trying ZoneInfo(value):
    on case-insensitive filesystems (macOS dev) ZoneInfo accepts variants like
    'asia/ho_chi_minh' that would then crash on the Linux production host.
    """
    if value not in _canonical_timezones():
        raise ValidationError(
            "%(value)s is not a valid IANA timezone name.",
            params={"value": value},
            code="invalid_timezone",
        )
