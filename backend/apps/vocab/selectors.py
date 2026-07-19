"""Read-side queries for the vocab app."""

from django.db.models import Count, Q, QuerySet

from apps.accounts.models import User
from apps.stats.selectors import MASTERED_INTERVAL_DAYS

from .models import Deck, UserWord


def _with_counts(decks: QuerySet[Deck]) -> QuerySet[Deck]:
    """Annotate word_count/mastered_count so deck serializers render
    "N từ · M thành thạo" without extra queries per deck."""
    return decks.annotate(
        word_count=Count("words"),
        mastered_count=Count("words", filter=Q(words__interval_days__gte=MASTERED_INTERVAL_DAYS)),
    )


def list_decks(*, owner: User) -> QuerySet[Deck]:
    """All decks owned by the user, in a stable order for pagination."""
    return _with_counts(Deck.objects.filter(owner=owner)).order_by("name")


def list_words(*, deck: Deck) -> QuerySet[UserWord]:
    """Words of one deck, newest first — a just-added word shows on top."""
    return deck.words.order_by("-created_at", "-id")


def list_starter_decks() -> QuerySet[Deck]:
    """System-curated decks any user may clone (SPEC §17.2-3)."""
    return _with_counts(Deck.objects.filter(is_starter=True)).order_by("name")


def public_decks() -> QuerySet[Deck]:
    """Decks anyone with the link may view on the share page (SPEC §17.2-13).
    Owner is prefetched for the display name; private decks stay out, so a
    lookup on this queryset 404s exactly like a missing id (SPEC §9)."""
    return _with_counts(
        Deck.objects.filter(visibility=Deck.Visibility.PUBLIC).select_related("owner")
    )
