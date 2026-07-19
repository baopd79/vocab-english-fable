"""Write-side services for the vocab app."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.enrichment.budget import has_ai_budget
from apps.enrichment.providers import provider_is_metered
from apps.enrichment.services import CONTENT_FIELDS
from apps.enrichment.tasks import enrich_user_word_task

from .exceptions import (
    AIBudgetExhausted,
    DeckNameConflict,
    EnrichmentNotFailed,
    InvalidWord,
    WordConflict,
)
from .models import Deck, UserWord, WordCache
from .normalization import InvalidWordError, normalize_word


def _require_ai_budget(*, word: str) -> None:
    """Reject early (429, SPEC §17.2-14) when enriching `word` would need a
    real AI call but the system-wide daily budget is gone. A word the cache
    already answers costs nothing, so it always passes."""
    if WordCache.objects.filter(word=word, status=WordCache.Status.COMPLETED).exists():
        return
    if provider_is_metered() and not has_ai_budget():
        raise AIBudgetExhausted


def create_deck(
    *,
    owner: User,
    name: str,
    description: str = "",
    visibility: str = Deck.Visibility.PRIVATE,
) -> Deck:
    """Create a deck, translating the unique (owner, name) clash into a 409.

    The try/except wraps the atomic block (not the reverse): once an
    IntegrityError fires, the transaction is broken and no further ORM call is
    allowed inside it — Django's rule is to catch it *outside* atomic().
    """
    try:
        with transaction.atomic():
            return Deck.objects.create(
                owner=owner, name=name, description=description, visibility=visibility
            )
    except IntegrityError as exc:
        raise DeckNameConflict from exc


def update_deck(
    *,
    deck: Deck,
    name: str | None = None,
    description: str | None = None,
    visibility: str | None = None,
) -> Deck:
    if name is not None:
        deck.name = name
    if description is not None:
        deck.description = description
    if visibility is not None:
        deck.visibility = visibility
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
    _require_ai_budget(word=normalized)
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
    _require_ai_budget(word=new_word)
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
    _require_ai_budget(word=user_word.word_text)
    with transaction.atomic():
        user_word.enrichment_status = UserWord.EnrichmentStatus.PENDING
        user_word.save(update_fields=["enrichment_status", "updated_at"])
        WordCache.objects.filter(word=user_word.word_text, status=WordCache.Status.FAILED).update(
            status=WordCache.Status.PENDING, updated_at=timezone.now()
        )
        transaction.on_commit(lambda: enrich_user_word_task.delay(user_word.pk))
    return user_word


# --- starter decks & cloning (SPEC §17.2-3, §17.4) -----------------------------

SYSTEM_USERNAME = "vocabun-system"


def get_or_create_system_user() -> User:
    """The account that owns system content (starter decks). It can never log
    in: is_active=False and no google_sub, so Google auth will not match it."""
    user, _ = User.objects.get_or_create(
        username=SYSTEM_USERNAME,
        defaults={
            "email": "system@vocabun.com",
            "is_active": False,
            "display_name": "Vocabun",
        },
    )
    return user


def clone_deck(*, owner: User, source: Deck) -> Deck:
    """Copy a starter deck into the user's account.

    Content fields (and completed enrichment status) travel with the copy, so
    a clone never enqueues enrichment, never calls the AI provider and never
    spends any quota or budget. SRS state starts fresh — progress is never
    copied (SPEC §17.2-13); every cloned word enters the queue as new.
    """
    try:
        with transaction.atomic():
            clone = Deck.objects.create(
                owner=owner,
                name=source.name,
                description=source.description,
                source_deck=source,
            )
            UserWord.objects.bulk_create(
                UserWord(
                    user=owner,
                    deck=clone,
                    word_cache_id=word.word_cache_id,
                    word_text=word.word_text,
                    part_of_speech=word.part_of_speech,
                    ipa=word.ipa,
                    meaning_vi=word.meaning_vi,
                    example_en=word.example_en,
                    example_vi=word.example_vi,
                    enrichment_status=word.enrichment_status,
                )
                for word in source.words.all()
            )
            return clone
    except IntegrityError as exc:
        raise DeckNameConflict from exc


@transaction.atomic
def seed_starter_deck(*, payload: dict) -> dict:
    """Create/refresh one system starter deck from a content JSON (Q3).

    Idempotent by word: existing deck words and existing WordCache rows are
    left untouched; only missing ones are created. Seeded cache rows carry
    provider="seed" so the 600 most common words answer any user's manual add
    for free — the AI provider is never called here.
    """
    owner = get_or_create_system_user()
    deck, _ = Deck.objects.get_or_create(
        owner=owner,
        name=payload["deck"]["name"],
        defaults={"description": payload["deck"].get("description", ""), "is_starter": True},
    )

    words = payload["words"]
    cached = set(
        WordCache.objects.filter(word__in=[w["word"] for w in words]).values_list("word", flat=True)
    )
    created_cache = WordCache.objects.bulk_create(
        WordCache(
            word=w["word"],
            status=WordCache.Status.COMPLETED,
            part_of_speech=w["part_of_speech"],
            ipa=w["ipa"],
            meaning_vi=w["meaning_vi"],
            example_en=w["example_en"],
            example_vi=w["example_vi"],
            provider="seed",
            model=payload["deck"]["name"],
        )
        for w in words
        if w["word"] not in cached
    )

    cache_ids = dict(
        WordCache.objects.filter(word__in=[w["word"] for w in words]).values_list("word", "id")
    )
    existing_words = set(deck.words.values_list("word_text", flat=True))
    created_words = UserWord.objects.bulk_create(
        UserWord(
            user=owner,
            deck=deck,
            word_cache_id=cache_ids[w["word"]],
            word_text=w["word"],
            part_of_speech=w["part_of_speech"],
            ipa=w["ipa"],
            meaning_vi=w["meaning_vi"],
            example_en=w["example_en"],
            example_vi=w["example_vi"],
            enrichment_status=UserWord.EnrichmentStatus.COMPLETED,
        )
        for w in words
        if w["word"] not in existing_words
    )
    return {
        "deck": deck.name,
        "words_created": len(created_words),
        "cache_created": len(created_cache),
    }
