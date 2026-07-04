"""Enrichment service + Celery task tests (SPEC §6.1) — provider is mocked;
tasks run eagerly via .apply(), so no broker or worker is involved."""

from unittest import mock

import pytest

from apps.enrichment import services
from apps.enrichment.providers import EnrichmentError, WordEnrichment
from apps.enrichment.tasks import enrich_user_word_task
from apps.vocab.factories import UserWordFactory, WordCacheFactory
from apps.vocab.models import UserWord, WordCache

pytestmark = pytest.mark.django_db

ENRICHMENT = WordEnrichment(
    part_of_speech="noun",
    ipa="/həˈloʊ/",
    meaning_vi="lời chào",
    example_en="She said hello.",
    example_vi="Cô ấy nói xin chào.",
)


def make_provider(side_effect=None):
    provider = mock.Mock()
    provider.name = "fake"
    provider.model = "fake"
    provider.enrich_word.return_value = ENRICHMENT
    if side_effect is not None:
        provider.enrich_word.side_effect = side_effect
    return provider


def patch_provider(provider):
    return mock.patch("apps.enrichment.services.get_provider", return_value=provider)


# --- service ---------------------------------------------------------------


def test_miss_calls_provider_and_completes_cache_and_user_word():
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider()

    with patch_provider(provider):
        outcome = services.enrich_user_word(user_word_id=user_word.pk)

    assert outcome == services.COMPLETED
    provider.enrich_word.assert_called_once_with("hello")
    cache = WordCache.objects.get(word="hello")
    assert cache.status == WordCache.Status.COMPLETED
    assert cache.meaning_vi == "lời chào"
    assert cache.provider == "fake" and cache.model == "fake"
    assert cache.raw_response["ipa"] == "/həˈloʊ/"
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
    assert user_word.word_cache == cache
    assert user_word.meaning_vi == "lời chào"


def test_cache_hit_copies_without_calling_provider():
    cache = WordCacheFactory(word="hello", status=WordCache.Status.COMPLETED, meaning_vi="lời chào")
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider()

    with patch_provider(provider):
        outcome = services.enrich_user_word(user_word_id=user_word.pk)

    assert outcome == services.COMPLETED
    provider.enrich_word.assert_not_called()
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
    assert user_word.word_cache == cache


def test_two_requests_same_word_trigger_one_ai_call():
    first = UserWordFactory(word_text="hello")
    second = UserWordFactory(word_text="hello")  # another user, same word
    provider = make_provider()

    with patch_provider(provider):
        services.enrich_user_word(user_word_id=first.pk)
        services.enrich_user_word(user_word_id=second.pk)

    provider.enrich_word.assert_called_once()
    assert WordCache.objects.filter(word="hello").count() == 1
    for word in (first, second):
        word.refresh_from_db()
        assert word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED


def test_processing_claim_is_not_stolen():
    WordCacheFactory(word="hello", status=WordCache.Status.PROCESSING)
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider()

    with patch_provider(provider):
        outcome = services.enrich_user_word(user_word_id=user_word.pk)

    assert outcome == services.WAITING
    provider.enrich_word.assert_not_called()
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.PENDING


def test_failed_cache_is_a_miss_and_gets_reclaimed():
    WordCacheFactory(word="hello", status=WordCache.Status.FAILED)
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider()

    with patch_provider(provider):
        outcome = services.enrich_user_word(user_word_id=user_word.pk)

    assert outcome == services.COMPLETED
    provider.enrich_word.assert_called_once()
    assert WordCache.objects.get(word="hello").status == WordCache.Status.COMPLETED


def test_provider_error_releases_claim_as_failed():
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider(side_effect=EnrichmentError("boom"))

    with patch_provider(provider), pytest.raises(EnrichmentError):
        services.enrich_user_word(user_word_id=user_word.pk)

    assert WordCache.objects.get(word="hello").status == WordCache.Status.FAILED
    user_word.refresh_from_db()  # not yet terminal — the task decides after retries
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.PENDING


def test_deleted_user_word_is_skipped():
    user_word = UserWordFactory(word_text="hello")
    pk = user_word.pk
    user_word.delete()
    provider = make_provider()

    with patch_provider(provider):
        assert services.enrich_user_word(user_word_id=pk) == services.SKIPPED
    provider.enrich_word.assert_not_called()


# --- Celery task (eager via .apply()) ---------------------------------------


def test_task_happy_path():
    user_word = UserWordFactory(word_text="hello")

    with patch_provider(make_provider()):
        result = enrich_user_word_task.apply(args=[user_word.pk])

    assert result.get() == services.COMPLETED
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED


def test_task_retries_then_marks_both_failed():
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider(side_effect=EnrichmentError("AI down"))

    with patch_provider(provider):
        result = enrich_user_word_task.apply(args=[user_word.pk])

    assert result.get() == "failed"
    assert provider.enrich_word.call_count == 4  # first attempt + 3 retries
    assert WordCache.objects.get(word="hello").status == WordCache.Status.FAILED
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.FAILED


def test_task_recovers_when_a_retry_succeeds():
    user_word = UserWordFactory(word_text="hello")
    provider = make_provider(side_effect=[EnrichmentError("blip"), ENRICHMENT])

    with patch_provider(provider):
        result = enrich_user_word_task.apply(args=[user_word.pk])

    assert result.get() == services.COMPLETED
    assert provider.enrich_word.call_count == 2
    user_word.refresh_from_db()
    assert user_word.enrichment_status == UserWord.EnrichmentStatus.COMPLETED
