"""Write-side services for the vocab app."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.enrichment.services import CONTENT_FIELDS
from apps.enrichment.tasks import enrich_user_word_task

from .exceptions import DeckNameConflict, EnrichmentNotFailed, InvalidWord, WordConflict
from .models import Deck, UserWord, WordCache
from .normalization import InvalidWordError, normalize_word


def create_deck(*, owner: User, name: str, description: str = "") -> Deck:
    """Create a deck, translating the unique (owner, name) clash into a 409.

    The try/except wraps the atomic block (not the reverse): once an
    IntegrityError fires, the transaction is broken and no further ORM call is
    allowed inside it — Django's rule is to catch it *outside* atomic().
    """
    try:
        with transaction.atomic():
            return Deck.objects.create(owner=owner, name=name, description=description)
    except IntegrityError as exc:
        raise DeckNameConflict from exc


def update_deck(*, deck: Deck, name: str | None = None, description: str | None = None) -> Deck:
    if name is not None:
        deck.name = name
    if description is not None:
        deck.description = description
    try:
        with transaction.atomic():
            deck.save()
    except IntegrityError as exc:
        raise DeckNameConflict from exc
    return deck


@transaction.atomic
def delete_deck(*, deck: Deck) -> None:
    # Cascades to the deck's UserWords; ReviewLogs are kept (SET_NULL) as history.
    deck.delete()


def create_user_word(*, deck: Deck, word: str) -> UserWord:
    """Add a word to a deck and queue its enrichment (SPEC §6.1).

    The task is enqueued via on_commit — a worker grabbing the id before the
    row is committed would see nothing and mark it skipped.
    """
    try:
        normalized = normalize_word(word)
    except InvalidWordError as exc:
        raise InvalidWord from exc
    try:
        with transaction.atomic():
            user_word = UserWord.objects.create(user=deck.owner, deck=deck, word_text=normalized)
            transaction.on_commit(lambda: enrich_user_word_task.delay(user_word.pk))
    except IntegrityError as exc:
        raise WordConflict from exc
    return user_word


def update_user_word(*, user_word: UserWord, data: dict) -> UserWord:
    """PATCH semantics per SPEC §9: a word_text change wins over everything —
    content fields sent alongside are ignored (re-enrichment overwrites them);
    otherwise only whitelisted content fields are updated."""
    raw_word = data.get("word_text")
    if raw_word is not None:
        try:
            normalized = normalize_word(raw_word)
        except InvalidWordError as exc:
            raise InvalidWord from exc
        if normalized != user_word.word_text:
            return _change_word_text(user_word=user_word, new_word=normalized)
    return _update_content(user_word=user_word, data=data)


def _change_word_text(*, user_word: UserWord, new_word: str) -> UserWord:
    """Keep SRS state, reset enrichment to pending, re-enqueue (SPEC §9)."""
    user_word.word_text = new_word
    user_word.enrichment_status = UserWord.EnrichmentStatus.PENDING
    user_word.word_cache = None
    try:
        with transaction.atomic():
            user_word.save(
                update_fields=["word_text", "enrichment_status", "word_cache", "updated_at"]
            )
            transaction.on_commit(lambda: enrich_user_word_task.delay(user_word.pk))
    except IntegrityError as exc:
        raise WordConflict from exc
    return user_word


@transaction.atomic
def _update_content(*, user_word: UserWord, data: dict) -> UserWord:
    changed = [field for field in CONTENT_FIELDS if field in data]
    if changed:
        for field in changed:
            setattr(user_word, field, data[field])
        user_word.full_clean()
        user_word.save(update_fields=[*changed, "updated_at"])
    return user_word


@transaction.atomic
def delete_user_word(*, user_word: UserWord) -> None:
    user_word.delete()


def retry_enrichment(*, user_word: UserWord) -> UserWord:
    """Only failed words can be retried (else 409); resets both the UserWord
    and the shared cache row (failed → pending) before re-enqueueing."""
    if user_word.enrichment_status != UserWord.EnrichmentStatus.FAILED:
        raise EnrichmentNotFailed
    with transaction.atomic():
        user_word.enrichment_status = UserWord.EnrichmentStatus.PENDING
        user_word.save(update_fields=["enrichment_status", "updated_at"])
        WordCache.objects.filter(word=user_word.word_text, status=WordCache.Status.FAILED).update(
            status=WordCache.Status.PENDING, updated_at=timezone.now()
        )
        transaction.on_commit(lambda: enrich_user_word_task.delay(user_word.pk))
    return user_word
