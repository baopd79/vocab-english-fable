"""Thin Celery wrapper around the enrichment service (SPEC §10).

Retry policy (SPEC §6.1): provider errors → exponential backoff, max 3
retries, then WordCache + UserWord are both `failed`. Claim contention →
short fixed countdown while the other worker finishes.
"""

from celery import shared_task
from celery.exceptions import MaxRetriesExceededError

from apps.enrichment import services
from apps.enrichment.providers import EnrichmentError

BACKOFF_BASE_SECONDS = 5  # error retries: 5s, 10s, 20s
WAIT_COUNTDOWN_SECONDS = 10  # claim contention: the other call is seconds away

FAILED = "failed"


@shared_task(bind=True, max_retries=3, rate_limit="30/m")
def enrich_user_word_task(self, user_word_id: int) -> str:
    try:
        outcome = services.enrich_user_word(user_word_id=user_word_id)
    except EnrichmentError as exc:
        if self.request.retries >= self.max_retries:
            services.mark_enrichment_failed(user_word_id=user_word_id)
            return FAILED
        raise self.retry(exc=exc, countdown=BACKOFF_BASE_SECONDS * 2**self.request.retries) from exc

    if outcome == services.WAITING:
        try:
            raise self.retry(countdown=WAIT_COUNTDOWN_SECONDS)
        except MaxRetriesExceededError:
            services.mark_enrichment_failed(user_word_id=user_word_id)
            return FAILED
    return outcome
