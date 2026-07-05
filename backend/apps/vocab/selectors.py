"""Read-side queries for the vocab app."""

from django.db.models import Count, Q, QuerySet

from apps.accounts.models import User
from apps.stats.selectors import MASTERED_INTERVAL_DAYS

from .models import Deck, UserWord


def list_decks(*, owner: User) -> QuerySet[Deck]:
    """All decks owned by the user, in a stable order for pagination.

    Annotated with word_count/mastered_count so the deck cards on the
    frontend render "N từ · M thành thạo" without extra requests.
    """
    return (
        Deck.objects.filter(owner=owner)
        .annotate(
            word_count=Count("words"),
            mastered_count=Count(
                "words", filter=Q(words__interval_days__gte=MASTERED_INTERVAL_DAYS)
            ),
        )
        .order_by("name")
    )


def list_words(*, deck: Deck) -> QuerySet[UserWord]:
    """Words of one deck, newest first — a just-added word shows on top."""
    return deck.words.order_by("-created_at", "-id")
