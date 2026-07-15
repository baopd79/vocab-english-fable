"""Words API tests (SPEC §7, §9) — the Celery task is mocked at the enqueue
boundary; on_commit callbacks are captured because pytest wraps each test in a
transaction that never commits."""

from unittest import mock

import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory
from apps.vocab.factories import DeckFactory, UserWordFactory, WordCacheFactory
from apps.vocab.models import UserWord, WordCache

pytestmark = pytest.mark.django_db


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def deck(user):
    return DeckFactory(owner=user)


@pytest.fixture
def task_delay():
    with mock.patch("apps.vocab.services.enrich_user_word_task.delay") as delay:
        yield delay


# --- POST /decks/{id}/words --------------------------------------------------


def test_create_word_normalizes_and_enqueues(
    client, deck, task_delay, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "  Hello  "})

    assert response.status_code == 201
    body = response.json()
    assert body["word_text"] == "hello"
    assert body["enrichment_status"] == "pending"
    task_delay.assert_called_once_with(body["id"])


def test_create_word_invalid_returns_400_invalid_word(client, deck, task_delay):
    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "123abc"})
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_word"
    task_delay.assert_not_called()


def test_create_word_duplicate_in_deck_returns_409(client, deck, task_delay):
    UserWordFactory(user=deck.owner, deck=deck, word_text="hello")
    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "HELLO"})
    assert response.status_code == 409
    assert response.json()["code"] == "word_conflict"


def test_same_word_in_another_deck_is_allowed(
    client, user, deck, task_delay, django_capture_on_commit_callbacks
):
    other_deck = DeckFactory(owner=user)
    UserWordFactory(user=user, deck=other_deck, word_text="hello")
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "hello"})
    assert response.status_code == 201


def test_create_word_in_another_users_deck_is_404(client, task_delay):
    other_deck = DeckFactory()
    response = client.post(f"/api/v1/decks/{other_deck.pk}/words", {"word": "hello"})
    assert response.status_code == 404
    task_delay.assert_not_called()


# --- GET /decks/{id}/words ---------------------------------------------------


def test_list_words_paginated_newest_first(client, user, deck):
    UserWordFactory(user=user, deck=deck, word_text="alpha")
    UserWordFactory(user=user, deck=deck, word_text="bravo")
    UserWordFactory(user=user)  # other deck, must not appear

    response = client.get(f"/api/v1/decks/{deck.pk}/words")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 2
    assert [w["word_text"] for w in body["results"]] == ["bravo", "alpha"]


def test_list_words_of_another_users_deck_is_404(client):
    response = client.get(f"/api/v1/decks/{DeckFactory().pk}/words")
    assert response.status_code == 404


# --- GET/PATCH/DELETE /words/{id} ---------------------------------------------


def test_get_word(client, user):
    word = UserWordFactory(user=user, word_text="hello")
    response = client.get(f"/api/v1/words/{word.pk}")
    assert response.status_code == 200
    assert response.json()["word_text"] == "hello"


def test_get_another_users_word_is_404(client):
    response = client.get(f"/api/v1/words/{UserWordFactory().pk}")
    assert response.status_code == 404


def test_patch_content_updates_user_copy_only(client, user, task_delay):
    cache_row = WordCacheFactory(
        word="hello", status=WordCache.Status.COMPLETED, meaning_vi="lời chào"
    )
    word = UserWordFactory(
        user=user,
        word_text="hello",
        word_cache=cache_row,
        meaning_vi="lời chào",
        enrichment_status=UserWord.EnrichmentStatus.COMPLETED,
    )

    response = client.patch(
        f"/api/v1/words/{word.pk}", {"meaning_vi": "chào hỏi", "ipa": "/x/"}, format="json"
    )

    assert response.status_code == 200
    word.refresh_from_db()
    assert word.meaning_vi == "chào hỏi"
    assert word.ipa == "/x/"
    assert word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
    cache_row.refresh_from_db()
    assert cache_row.meaning_vi == "lời chào"  # shared cache untouched (AC)
    task_delay.assert_not_called()


def test_patch_srs_fields_is_silently_ignored(client, user):
    word = UserWordFactory(user=user, ease_factor=2.5, repetitions=0)
    response = client.patch(
        f"/api/v1/words/{word.pk}",
        {"ease_factor": 9.9, "repetitions": 42, "enrichment_status": "completed"},
        format="json",
    )
    assert response.status_code == 200
    word.refresh_from_db()
    assert word.ease_factor == 2.5
    assert word.repetitions == 0
    assert word.enrichment_status == UserWord.EnrichmentStatus.PENDING


def test_patch_word_text_reenriches_keeps_srs_ignores_content(
    client, user, task_delay, django_capture_on_commit_callbacks
):
    word = UserWordFactory(
        user=user,
        word_text="hello",
        word_cache=WordCacheFactory(word="hello"),
        meaning_vi="lời chào",
        enrichment_status=UserWord.EnrichmentStatus.COMPLETED,
        repetitions=3,
        interval_days=6,
    )

    with django_capture_on_commit_callbacks(execute=True):
        response = client.patch(
            f"/api/v1/words/{word.pk}",
            {"word_text": "  World ", "meaning_vi": "PHẢI BỊ BỎ QUA"},
            format="json",
        )

    assert response.status_code == 200
    word.refresh_from_db()
    assert word.word_text == "world"
    assert word.enrichment_status == UserWord.EnrichmentStatus.PENDING
    assert word.word_cache is None
    assert word.meaning_vi == "lời chào"  # content edit in same request ignored
    assert word.repetitions == 3 and word.interval_days == 6  # SRS kept
    task_delay.assert_called_once_with(word.pk)


def test_patch_word_text_duplicate_returns_409(client, user, deck, task_delay):
    UserWordFactory(user=user, deck=deck, word_text="world")
    word = UserWordFactory(user=user, deck=deck, word_text="hello")
    response = client.patch(f"/api/v1/words/{word.pk}", {"word_text": "world"}, format="json")
    assert response.status_code == 409
    assert response.json()["code"] == "word_conflict"


def test_patch_word_text_invalid_returns_400(client, user):
    word = UserWordFactory(user=user, word_text="hello")
    response = client.patch(f"/api/v1/words/{word.pk}", {"word_text": "!!!"}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_word"


def test_patch_word_text_same_value_updates_content(client, user, task_delay):
    word = UserWordFactory(user=user, word_text="hello")
    response = client.patch(
        f"/api/v1/words/{word.pk}",
        {"word_text": "hello", "meaning_vi": "chào"},
        format="json",
    )
    assert response.status_code == 200
    word.refresh_from_db()
    assert word.meaning_vi == "chào"
    task_delay.assert_not_called()


def test_delete_word(client, user):
    word = UserWordFactory(user=user)
    response = client.delete(f"/api/v1/words/{word.pk}")
    assert response.status_code == 204
    assert not UserWord.objects.filter(pk=word.pk).exists()


# --- POST /words/{id}/retry-enrichment ----------------------------------------


def test_retry_failed_word_resets_both_and_enqueues(
    client, user, task_delay, django_capture_on_commit_callbacks
):
    cache_row = WordCacheFactory(word="hello", status=WordCache.Status.FAILED)
    word = UserWordFactory(
        user=user, word_text="hello", enrichment_status=UserWord.EnrichmentStatus.FAILED
    )

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f"/api/v1/words/{word.pk}/retry-enrichment")

    assert response.status_code == 200
    assert response.json()["enrichment_status"] == "pending"
    cache_row.refresh_from_db()
    assert cache_row.status == WordCache.Status.PENDING
    task_delay.assert_called_once_with(word.pk)


def test_retry_non_failed_word_returns_409(client, user, task_delay):
    word = UserWordFactory(user=user, enrichment_status=UserWord.EnrichmentStatus.PENDING)
    response = client.post(f"/api/v1/words/{word.pk}/retry-enrichment")
    assert response.status_code == 409
    assert response.json()["code"] == "enrichment_not_failed"
    task_delay.assert_not_called()


# --- throttling (SPEC §8) ------------------------------------------------------


@pytest.fixture
def enrichment_throttle_3_per_day():
    """Enable the enrichment scope with a tiny budget. DRF binds THROTTLE_RATES
    as a class attribute at import time, so patch the class, not settings."""
    from rest_framework.throttling import SimpleRateThrottle

    original = SimpleRateThrottle.THROTTLE_RATES
    SimpleRateThrottle.THROTTLE_RATES = {"user": None, "enrichment": "3/day"}
    cache.clear()
    yield
    SimpleRateThrottle.THROTTLE_RATES = original
    cache.clear()


def test_enrichment_budget_shared_across_post_retry_and_rename(
    client, user, deck, task_delay, enrichment_throttle_3_per_day
):
    failed = UserWordFactory(
        user=user, deck=deck, word_text="zzz", enrichment_status=UserWord.EnrichmentStatus.FAILED
    )

    assert client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "one"}).status_code == 201
    assert client.post(f"/api/v1/words/{failed.pk}/retry-enrichment").status_code == 200
    assert (
        client.patch(f"/api/v1/words/{failed.pk}", {"word_text": "yyy"}, format="json").status_code
        == 200
    )

    # Budget exhausted — every enrichment-scoped action is now 429.
    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "two"})
    assert response.status_code == 429
    assert response.json()["code"] == "throttled"

    # GET and non-word_text PATCH stay outside the enrichment scope.
    assert client.get(f"/api/v1/decks/{deck.pk}/words").status_code == 200
    assert (
        client.patch(f"/api/v1/words/{failed.pk}", {"meaning_vi": "x"}, format="json").status_code
        == 200
    )


def test_enrichment_rate_is_50_per_day_in_real_settings():
    from config.settings.base import REST_FRAMEWORK as base_rf

    assert base_rf["DEFAULT_THROTTLE_RATES"]["enrichment"] == "50/day"
    assert base_rf["DEFAULT_THROTTLE_RATES"]["user"] == "1000/hour"


@override_settings()
def test_throttle_disabled_in_test_settings_does_not_block(client, deck, task_delay):
    for i in range(5):
        assert (
            client.post(f"/api/v1/decks/{deck.pk}/words", {"word": f"word{'x' * i}"}).status_code
            == 201
        )


# --- system-wide AI budget (SPEC §17.2-14) ------------------------------------


@override_settings(AI_PROVIDER="gemini", GEMINI_DAILY_BUDGET=0)
def test_add_word_rejected_when_system_budget_gone(client, deck, task_delay):
    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "hello"})

    assert response.status_code == 429
    assert response.json()["code"] == "ai_budget_exceeded"
    assert not UserWord.objects.filter(word_text="hello").exists()
    task_delay.assert_not_called()


@override_settings(AI_PROVIDER="gemini", GEMINI_DAILY_BUDGET=0)
def test_add_cached_word_passes_despite_exhausted_budget(client, deck, task_delay):
    # A completed cache row answers for free — no AI call, no budget needed.
    WordCacheFactory(word="hello", status=WordCache.Status.COMPLETED)

    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "hello"})

    assert response.status_code == 201


@override_settings(AI_PROVIDER="gemini", GEMINI_DAILY_BUDGET=0)
def test_retry_enrichment_rejected_when_system_budget_gone(client, user, task_delay):
    failed = UserWordFactory(user=user, enrichment_status=UserWord.EnrichmentStatus.FAILED)

    response = client.post(f"/api/v1/words/{failed.pk}/retry-enrichment")

    assert response.status_code == 429
    assert response.json()["code"] == "ai_budget_exceeded"


@override_settings(AI_PROVIDER="gemini", GEMINI_DAILY_BUDGET=0)
def test_rename_word_rejected_when_system_budget_gone(client, user, task_delay):
    word = UserWordFactory(user=user, word_text="hello")

    response = client.patch(f"/api/v1/words/{word.pk}", {"word_text": "world"}, format="json")

    assert response.status_code == 429
    assert response.json()["code"] == "ai_budget_exceeded"
    word.refresh_from_db()
    assert word.word_text == "hello"  # nothing changed


@override_settings(AI_PROVIDER="fake", GEMINI_DAILY_BUDGET=0)
def test_fake_provider_never_hits_the_budget(client, deck, task_delay):
    response = client.post(f"/api/v1/decks/{deck.pk}/words", {"word": "hello"})
    assert response.status_code == 201
