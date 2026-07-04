from django.urls import path

from .views import (
    DeckDetailView,
    DeckListView,
    DeckWordListView,
    RetryEnrichmentView,
    UserWordDetailView,
)

urlpatterns = [
    path("decks", DeckListView.as_view(), name="deck-list"),
    path("decks/<int:pk>", DeckDetailView.as_view(), name="deck-detail"),
    path("decks/<int:pk>/words", DeckWordListView.as_view(), name="deck-word-list"),
    path("words/<int:pk>", UserWordDetailView.as_view(), name="word-detail"),
    path(
        "words/<int:pk>/retry-enrichment",
        RetryEnrichmentView.as_view(),
        name="word-retry-enrichment",
    ),
]
