from django.urls import path

from .views import (
    DeckCloneView,
    DeckDetailView,
    DeckListView,
    DeckWordListView,
    RetryEnrichmentView,
    StarterDeckListView,
    UserWordDetailView,
)

urlpatterns = [
    path("decks", DeckListView.as_view(), name="deck-list"),
    # Before decks/<int:pk> so the literal segment is never shadowed.
    path("decks/starter", StarterDeckListView.as_view(), name="deck-starter-list"),
    path("decks/<int:pk>", DeckDetailView.as_view(), name="deck-detail"),
    path("decks/<int:pk>/clone", DeckCloneView.as_view(), name="deck-clone"),
    path("decks/<int:pk>/words", DeckWordListView.as_view(), name="deck-word-list"),
    path("words/<int:pk>", UserWordDetailView.as_view(), name="word-detail"),
    path(
        "words/<int:pk>/retry-enrichment",
        RetryEnrichmentView.as_view(),
        name="word-retry-enrichment",
    ),
]
