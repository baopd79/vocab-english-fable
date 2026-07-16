"""Starter decks: seed service + clone flow (SPEC §17.2-3, §17.4)."""

from unittest import mock

import pytest
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.vocab import services
from apps.vocab.factories import DeckFactory, UserWordFactory, WordCacheFactory
from apps.vocab.models import Deck, UserWord, WordCache

pytestmark = pytest.mark.django_db

PAYLOAD = {
    "deck": {"name": "Starter Book 1", "description": "Bộ từ nền tảng."},
    "words": [
        {
            "word": "afraid",
            "part_of_speech": "adjective",
            "ipa": "/əˈfreɪd/",
            "meaning_vi": "Sợ hãi",
            "example_en": "I am afraid of dogs.",
            "example_vi": "Tôi sợ chó.",
        },
        {
            "word": "agree",
            "part_of_speech": "verb",
            "ipa": "/əˈgriː/",
            "meaning_vi": "Đồng ý",
            "example_en": "I agree with you.",
            "example_vi": "Tôi đồng ý với bạn.",
        },
    ],
}


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def starter_deck():
    services.seed_starter_deck(payload=PAYLOAD)
    return Deck.objects.get(name="Starter Book 1")


# --- seed service --------------------------------------------------------------


def test_seed_creates_system_deck_words_and_cache():
    result = services.seed_starter_deck(payload=PAYLOAD)

    assert result == {"deck": "Starter Book 1", "words_created": 2, "cache_created": 2}
    deck = Deck.objects.get(name="Starter Book 1")
    assert deck.is_starter is True
    assert deck.owner.username == services.SYSTEM_USERNAME
    assert deck.owner.is_active is False  # the system account can never log in

    word = deck.words.get(word_text="afraid")
    assert word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
    assert word.meaning_vi == "Sợ hãi"
    cache = WordCache.objects.get(word="afraid")
    assert cache.status == WordCache.Status.COMPLETED
    assert cache.provider == "seed"
    assert word.word_cache == cache


def test_seed_is_idempotent():
    services.seed_starter_deck(payload=PAYLOAD)
    result = services.seed_starter_deck(payload=PAYLOAD)

    assert result == {"deck": "Starter Book 1", "words_created": 0, "cache_created": 0}
    assert Deck.objects.filter(is_starter=True).count() == 1
    assert UserWord.objects.filter(deck__is_starter=True).count() == 2


def test_seed_leaves_existing_cache_rows_alone():
    WordCacheFactory(word="afraid", status=WordCache.Status.COMPLETED, meaning_vi="nghĩa AI")

    services.seed_starter_deck(payload=PAYLOAD)

    cache = WordCache.objects.get(word="afraid")
    assert cache.meaning_vi == "nghĩa AI"  # AI content not overwritten
    # The starter word still links to the pre-existing row but keeps curated content.
    word = UserWord.objects.get(deck__is_starter=True, word_text="afraid")
    assert word.word_cache == cache
    assert word.meaning_vi == "Sợ hãi"


# --- GET /decks/starter ---------------------------------------------------------


def test_starter_list_visible_to_any_user(client, starter_deck):
    response = client.get("/api/v1/decks/starter")

    assert response.status_code == 200
    results = response.json()["results"]
    assert [d["name"] for d in results] == ["Starter Book 1"]
    assert results[0]["is_starter"] is True
    assert results[0]["word_count"] == 2


def test_starter_list_requires_auth(starter_deck):
    assert APIClient().get("/api/v1/decks/starter").status_code == 401


def test_starter_deck_not_in_my_decks_list(client, starter_deck):
    response = client.get("/api/v1/decks")
    assert response.json()["results"] == []  # owned by the system user, not me


# --- POST /decks/{id}/clone -----------------------------------------------------


def test_clone_copies_content_but_never_progress(client, user, starter_deck):
    # Give the source deck some fake progress — it must not travel.
    source_word = starter_deck.words.get(word_text="afraid")
    UserWord.objects.filter(pk=source_word.pk).update(repetitions=5, interval_days=30)

    with mock.patch("apps.vocab.services.enrich_user_word_task.delay") as delay:
        response = client.post(f"/api/v1/decks/{starter_deck.pk}/clone")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Starter Book 1"
    assert body["source_deck"] == starter_deck.pk
    assert body["is_starter"] is False

    clone = Deck.objects.get(pk=body["id"])
    assert clone.owner == user
    words = {w.word_text: w for w in clone.words.all()}
    assert set(words) == {"afraid", "agree"}
    afraid = words["afraid"]
    assert afraid.meaning_vi == "Sợ hãi"
    assert afraid.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
    assert afraid.repetitions == 0 and afraid.interval_days == 0
    assert afraid.first_reviewed_at is None  # enters the queue as a new card

    delay.assert_not_called()  # cloning never enqueues enrichment (AC)


def test_clone_twice_is_a_name_conflict(client, starter_deck):
    assert client.post(f"/api/v1/decks/{starter_deck.pk}/clone").status_code == 201

    response = client.post(f"/api/v1/decks/{starter_deck.pk}/clone")

    assert response.status_code == 409
    assert response.json()["code"] == "deck_name_conflict"


def test_clone_non_starter_deck_is_404(client, user):
    own = DeckFactory(owner=user)
    other = DeckFactory()  # someone else's private deck
    UserWordFactory(deck=other, user=other.owner)

    assert client.post(f"/api/v1/decks/{own.pk}/clone").status_code == 404
    assert client.post(f"/api/v1/decks/{other.pk}/clone").status_code == 404


def test_clone_requires_auth(starter_deck):
    assert APIClient().post(f"/api/v1/decks/{starter_deck.pk}/clone").status_code == 401


# --- management command ---------------------------------------------------------


def test_seed_command_reads_data_dir(tmp_path, monkeypatch):
    import json

    from apps.vocab.management.commands import seed_starter_decks as cmd_module

    (tmp_path / "book.json").write_text(json.dumps(PAYLOAD), encoding="utf-8")
    monkeypatch.setattr(cmd_module, "DATA_DIR", tmp_path)

    from django.core.management import call_command

    call_command("seed_starter_decks")

    assert Deck.objects.filter(is_starter=True, name="Starter Book 1").exists()
