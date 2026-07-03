"""Read-side queries for the vocab app."""

from django.db.models import QuerySet

from apps.accounts.models import User

from .models import Deck


def list_decks(*, owner: User) -> QuerySet[Deck]:
    """All decks owned by the user, in a stable order for pagination."""
    return Deck.objects.filter(owner=owner).order_by("name")
