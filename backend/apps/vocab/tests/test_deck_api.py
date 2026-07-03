"""API tests for the deck endpoints (SPEC §7, §9)."""

import pytest
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.vocab.factories import DeckFactory, UserWordFactory
from apps.vocab.models import Deck, UserWord

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


class TestCreateDeck:
    def test_create_returns_201_and_persists(self, client, user):
        response = client.post("/api/v1/decks", {"name": "IELTS", "description": "band 7"})

        assert response.status_code == 201
        assert response.data["name"] == "IELTS"
        assert response.data["visibility"] == "private"
        deck = Deck.objects.get(pk=response.data["id"])
        assert deck.owner == user

    def test_name_is_trimmed(self, client):
        response = client.post("/api/v1/decks", {"name": "  Travel  "})

        assert response.status_code == 201
        assert response.data["name"] == "Travel"

    def test_empty_name_returns_validation_error(self, client):
        response = client.post("/api/v1/decks", {"name": "   "})

        assert response.status_code == 400
        assert response.data["code"] == "validation_error"
        assert "name" in response.data["errors"]

    def test_duplicate_name_returns_409(self, client, user):
        DeckFactory(owner=user, name="IELTS")

        response = client.post("/api/v1/decks", {"name": "IELTS"})

        assert response.status_code == 409
        assert response.data["code"] == "deck_name_conflict"
        assert Deck.objects.filter(owner=user, name="IELTS").count() == 1

    def test_visibility_is_read_only(self, client):
        response = client.post("/api/v1/decks", {"name": "Hacky", "visibility": "public"})

        assert response.status_code == 201
        assert response.data["visibility"] == "private"

    def test_requires_authentication(self):
        response = APIClient().post("/api/v1/decks", {"name": "X"})

        assert response.status_code == 401
        assert response.data["code"] == "not_authenticated"


class TestListDecks:
    def test_lists_only_own_decks(self, client, user):
        DeckFactory(owner=user, name="Mine A")
        DeckFactory(owner=user, name="Mine B")
        DeckFactory()  # another user's deck

        response = client.get("/api/v1/decks")

        assert response.status_code == 200
        assert response.data["count"] == 2
        names = {row["name"] for row in response.data["results"]}
        assert names == {"Mine A", "Mine B"}

    def test_pagination_caps_at_50_per_page(self, client, user):
        DeckFactory.create_batch(51, owner=user)

        first = client.get("/api/v1/decks")
        assert first.data["count"] == 51
        assert len(first.data["results"]) == 50
        assert first.data["next"] is not None

        second = client.get("/api/v1/decks", {"page": 2})
        assert len(second.data["results"]) == 1


class TestRetrieveDeck:
    def test_retrieve_own_deck(self, client, user):
        deck = DeckFactory(owner=user, name="Mine")

        response = client.get(f"/api/v1/decks/{deck.pk}")

        assert response.status_code == 200
        assert response.data["name"] == "Mine"

    def test_other_users_deck_returns_404(self, client):
        other = DeckFactory()  # different owner

        response = client.get(f"/api/v1/decks/{other.pk}")

        assert response.status_code == 404
        assert response.data["code"] == "not_found"


class TestUpdateDeck:
    def test_update_name_and_description(self, client, user):
        deck = DeckFactory(owner=user, name="Old")

        response = client.patch(
            f"/api/v1/decks/{deck.pk}", {"name": "New", "description": "d"}, format="json"
        )

        assert response.status_code == 200
        deck.refresh_from_db()
        assert deck.name == "New"
        assert deck.description == "d"

    def test_rename_to_existing_name_returns_409(self, client, user):
        DeckFactory(owner=user, name="Taken")
        deck = DeckFactory(owner=user, name="Free")

        response = client.patch(f"/api/v1/decks/{deck.pk}", {"name": "Taken"}, format="json")

        assert response.status_code == 409
        assert response.data["code"] == "deck_name_conflict"
        deck.refresh_from_db()
        assert deck.name == "Free"

    def test_cannot_update_other_users_deck(self, client):
        other = DeckFactory()

        response = client.patch(f"/api/v1/decks/{other.pk}", {"name": "Hijacked"}, format="json")

        assert response.status_code == 404


class TestDeleteDeck:
    def test_delete_cascades_user_words(self, client, user):
        word = UserWordFactory(user=user)
        deck_pk = word.deck.pk

        response = client.delete(f"/api/v1/decks/{deck_pk}")

        assert response.status_code == 204
        assert not Deck.objects.filter(pk=deck_pk).exists()
        assert not UserWord.objects.filter(pk=word.pk).exists()

    def test_cannot_delete_other_users_deck(self, client):
        other = DeckFactory()

        response = client.delete(f"/api/v1/decks/{other.pk}")

        assert response.status_code == 404
        assert Deck.objects.filter(pk=other.pk).exists()
