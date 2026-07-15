"""Enrichment workflow (SPEC §6.1).

The orchestrator `enrich_user_word` deliberately holds NO transaction: the AI
call must happen outside any DB transaction. The cache claim is a single
atomic UPDATE (pending|failed → processing), never a row lock.
"""

from dataclasses import asdict

from django.db import transaction
from django.utils import timezone

from apps.enrichment.budget import spend_ai_budget
from apps.enrichment.providers import AIProvider, WordEnrichment, get_provider
from apps.vocab.models import UserWord, WordCache

CONTENT_FIELDS = ("part_of_speech", "ipa", "meaning_vi", "example_en", "example_vi")

# Outcomes returned to the Celery task (which decides on retries).
COMPLETED = "completed"
WAITING = "waiting"  # another task holds the claim — check back later
SKIPPED = "skipped"  # the UserWord vanished while the task sat in the queue
BUDGET_EXCEEDED = "budget_exceeded"  # daily AI budget gone — terminal for today


def enrich_user_word(*, user_word_id: int) -> str:
    """Run one enrichment attempt for a UserWord and return an outcome.

    Raises EnrichmentError when the provider fails; the cache claim is
    released back to `failed` first (failed-as-miss, re-claimable), and the
    task translates the exception into retry-with-backoff.
    """
    try:
        user_word = UserWord.objects.get(pk=user_word_id)
    except UserWord.DoesNotExist:
        return SKIPPED

    cache, _ = WordCache.objects.get_or_create(word=user_word.word_text)

    if cache.status == WordCache.Status.COMPLETED:
        complete_user_word_from_cache(user_word=user_word, cache=cache)
        return COMPLETED

    if not claim_word_cache(cache=cache):
        return WAITING

    provider = get_provider()
    # The slot is reserved *before* the call so racing workers can never
    # overspend; fail-as-miss keeps the word retryable after the Pacific-
    # midnight reset (SPEC §17.2-14).
    if provider.is_metered and not spend_ai_budget():
        release_claim_as_failed(cache=cache)
        return BUDGET_EXCEEDED
    try:
        enrichment = provider.enrich_word(user_word.word_text)
    except Exception:
        release_claim_as_failed(cache=cache)
        raise

    complete_word_cache(cache=cache, enrichment=enrichment, provider=provider)
    complete_user_word_from_cache(user_word=user_word, cache=cache)
    return COMPLETED


def claim_word_cache(*, cache: WordCache) -> bool:
    """Atomically take ownership: pending|failed → processing.

    A single UPDATE ... WHERE status IN (...) — concurrent tasks race on the
    WHERE clause, exactly one wins. False means someone else is processing.
    """
    claimed = WordCache.objects.filter(
        pk=cache.pk,
        status__in=[WordCache.Status.PENDING, WordCache.Status.FAILED],
    ).update(status=WordCache.Status.PROCESSING, updated_at=timezone.now())
    return bool(claimed)


def release_claim_as_failed(*, cache: WordCache) -> None:
    """Give the claim back as `failed` so a later attempt can re-claim it."""
    WordCache.objects.filter(pk=cache.pk, status=WordCache.Status.PROCESSING).update(
        status=WordCache.Status.FAILED, updated_at=timezone.now()
    )


@transaction.atomic
def complete_word_cache(
    *, cache: WordCache, enrichment: WordEnrichment, provider: AIProvider
) -> None:
    cache.part_of_speech = enrichment.part_of_speech
    cache.ipa = enrichment.ipa
    cache.meaning_vi = enrichment.meaning_vi
    cache.example_en = enrichment.example_en
    cache.example_vi = enrichment.example_vi
    cache.raw_response = asdict(enrichment)
    cache.provider = provider.name
    cache.model = provider.model
    cache.status = WordCache.Status.COMPLETED
    cache.full_clean()
    cache.save()


def complete_user_word_from_cache(*, user_word: UserWord, cache: WordCache) -> None:
    """Copy cache content into the user's own row (queryset UPDATE: a word
    deleted mid-flight silently affects 0 rows instead of crashing)."""
    UserWord.objects.filter(pk=user_word.pk).update(
        **{field: getattr(cache, field) for field in CONTENT_FIELDS},
        word_cache=cache,
        enrichment_status=UserWord.EnrichmentStatus.COMPLETED,
        updated_at=timezone.now(),
    )


def mark_enrichment_failed(*, user_word_id: int) -> None:
    """Terminal failure after retries are exhausted (the cache row was already
    released as `failed` when the last attempt raised)."""
    UserWord.objects.filter(pk=user_word_id).update(
        enrichment_status=UserWord.EnrichmentStatus.FAILED, updated_at=timezone.now()
    )
