"""Write-side services for the vocab app."""

from django.db import IntegrityError, transaction

from apps.accounts.models import User

from .exceptions import DeckNameConflict
from .models import Deck


def create_deck(*, owner: User, name: str, description: str = "") -> Deck:
    """Create a deck, translating the unique (owner, name) clash into a 409.

    The try/except wraps the atomic block (not the reverse): once an
    IntegrityError fires, the transaction is broken and no further ORM call is
    allowed inside it — Django's rule is to catch it *outside* atomic().
    """
    try:
        with transaction.atomic():
            return Deck.objects.create(owner=owner, name=name, description=description)
    except IntegrityError as exc:
        raise DeckNameConflict from exc


def update_deck(*, deck: Deck, name: str | None = None, description: str | None = None) -> Deck:
    if name is not None:
        deck.name = name
    if description is not None:
        deck.description = description
    try:
        with transaction.atomic():
            deck.save()
    except IntegrityError as exc:
        raise DeckNameConflict from exc
    return deck


@transaction.atomic
def delete_deck(*, deck: Deck) -> None:
    # Cascades to the deck's UserWords; ReviewLogs are kept (SET_NULL) as history.
    deck.delete()
