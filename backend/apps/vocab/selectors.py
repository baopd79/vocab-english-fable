"""Read-side queries for the vocab app."""

from django.db.models import QuerySet

from apps.accounts.models import User

from .models import Deck, UserWord


def list_decks(*, owner: User) -> QuerySet[Deck]:
    """All decks owned by the user, in a stable order for pagination."""
    return Deck.objects.filter(owner=owner).order_by("name")


def list_words(*, deck: Deck) -> QuerySet[UserWord]:
    """Words of one deck, newest first — a just-added word shows on top."""
    return deck.words.order_by("-created_at", "-id")
