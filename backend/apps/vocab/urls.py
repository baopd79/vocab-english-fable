from django.urls import path

from .views import DeckDetailView, DeckListView

urlpatterns = [
    path("decks", DeckListView.as_view(), name="deck-list"),
    path("decks/<int:pk>", DeckDetailView.as_view(), name="deck-detail"),
]
