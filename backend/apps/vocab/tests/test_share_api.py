"""Public deck sharing: visibility toggle, share endpoints, clone (SPEC §17.2-13, §17.3-Q4)."""

from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.vocab.factories import DeckFactory, UserWordFactory
from apps.vocab.models import Deck, UserWord

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return UserFactory(display_name="Bảo")


@pytest.fixture
def owner_client(owner):
    api_client = APIClient()
    api_client.force_authenticate(user=owner)
    return api_client


@pytest.fixture
def public_deck(owner):
    deck = DeckFactory(owner=owner, name="IELTS Core", visibility=Deck.Visibility.PUBLIC)
    UserWordFactory(
        deck=deck,
        user=owner,
        word_text="ubiquitous",
        meaning_vi="có mặt khắp nơi",
        enrichment_status=UserWord.EnrichmentStatus.COMPLETED,
        repetitions=7,
        interval_days=42,
    )
    return deck


@pytest.fixture
def private_deck(owner):
    deck = DeckFactory(owner=owner, visibility=Deck.Visibility.PRIVATE)
    UserWordFactory(deck=deck, user=owner)
    return deck


# --- visibility toggle (PATCH /decks/{id}) ---------------------------------------


def test_owner_toggles_deck_public_and_back(owner_client, private_deck):
    response = owner_client.patch(
        f"/api/v1/decks/{private_deck.pk}", {"visibility": "public"}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["visibility"] == "public"

    response = owner_client.patch(
        f"/api/v1/decks/{private_deck.pk}", {"visibility": "private"}, format="json"
    )
    assert response.json()["visibility"] == "private"


def test_visibility_rejects_unknown_value(owner_client, private_deck):
    response = owner_client.patch(
        f"/api/v1/decks/{private_deck.pk}", {"visibility": "unlisted"}, format="json"
    )

    assert response.status_code == 400
    assert "visibility" in response.json()["errors"]


def test_other_user_cannot_toggle_my_deck(private_deck):
    client = APIClient()
    client.force_authenticate(user=UserFactory())

    response = client.patch(
        f"/api/v1/decks/{private_deck.pk}", {"visibility": "public"}, format="json"
    )

    assert response.status_code == 404  # indistinguishable from missing (SPEC §9)


# --- GET /decks/{id}/public -------------------------------------------------------


def test_share_page_is_readable_without_login(public_deck):
    response = APIClient().get(f"/api/v1/decks/{public_deck.pk}/public")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "id": public_deck.pk,
        "name": "IELTS Core",
        "description": public_deck.description,
        "owner_name": "Bảo",
        "word_count": 1,
    }
    assert "email" not in str(body)


def test_share_page_404_for_private_deck(private_deck):
    anon = APIClient().get(f"/api/v1/decks/{private_deck.pk}/public")
    assert anon.status_code == 404

    stranger = APIClient()
    stranger.force_authenticate(user=UserFactory())
    assert stranger.get(f"/api/v1/decks/{private_deck.pk}/public").status_code == 404


def test_share_words_are_content_only(public_deck):
    response = APIClient().get(f"/api/v1/decks/{public_deck.pk}/public/words")

    assert response.status_code == 200
    results = response.json()["results"]
    assert [w["word_text"] for w in results] == ["ubiquitous"]
    # The owner's SRS progress must not leak through the share page.
    leaked = {"repetitions", "interval_days", "ease_factor", "due_at", "enrichment_status"}
    assert leaked.isdisjoint(results[0].keys())


def test_share_words_404_for_private_deck(private_deck):
    response = APIClient().get(f"/api/v1/decks/{private_deck.pk}/public/words")
    assert response.status_code == 404


# --- clone a public deck ----------------------------------------------------------


def test_stranger_clones_public_deck_without_progress(public_deck):
    stranger = UserFactory()
    client = APIClient()
    client.force_authenticate(user=stranger)

    with mock.patch("apps.vocab.services.enrich_user_word_task.delay") as delay:
        response = client.post(f"/api/v1/decks/{public_deck.pk}/clone")

    assert response.status_code == 201
    clone = Deck.objects.get(pk=response.json()["id"])
    assert clone.owner == stranger
    assert clone.visibility == Deck.Visibility.PRIVATE  # a clone starts private
    word = clone.words.get()
    assert word.meaning_vi == "có mặt khắp nơi"
    assert word.repetitions == 0 and word.first_reviewed_at is None
    delay.assert_not_called()


def test_clone_private_deck_is_404_for_stranger(private_deck):
    client = APIClient()
    client.force_authenticate(user=UserFactory())

    assert client.post(f"/api/v1/decks/{private_deck.pk}/clone").status_code == 404


def test_clone_still_requires_login(public_deck):
    assert APIClient().post(f"/api/v1/decks/{public_deck.pk}/clone").status_code == 401


# --- throttling -------------------------------------------------------------------


def test_share_endpoints_use_the_share_scope():
    from apps.vocab.views import PublicDeckView, PublicDeckWordListView

    assert PublicDeckView.throttle_scope == "share"
    assert PublicDeckWordListView.throttle_scope == "share"
