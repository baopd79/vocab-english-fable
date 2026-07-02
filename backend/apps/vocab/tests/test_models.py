"""Constraint and cascade tests for vocab models (SPEC §5)."""

import pytest
from django.db import IntegrityError

from apps.accounts.factories import UserFactory
from apps.vocab.factories import DeckFactory, UserWordFactory, WordCacheFactory
from apps.vocab.models import UserWord

pytestmark = pytest.mark.django_db


class TestDeckConstraints:
    def test_duplicate_name_for_same_owner_rejected(self):
        deck = DeckFactory(name="IELTS")
        with pytest.raises(IntegrityError):
            DeckFactory(name="IELTS", owner=deck.owner)

    def test_same_name_for_different_owners_allowed(self):
        DeckFactory(name="IELTS")
        DeckFactory(name="IELTS")  # different owner via factory sequence

    def test_defaults(self):
        deck = DeckFactory()
        assert deck.visibility == "private"
        assert deck.description == ""


class TestUserWordConstraints:
    def test_duplicate_word_in_same_deck_rejected(self):
        word = UserWordFactory(word_text="hello")
        with pytest.raises(IntegrityError):
            UserWordFactory(word_text="hello", deck=word.deck, user=word.user)

    def test_same_word_in_different_decks_allowed(self):
        user = UserFactory()
        UserWordFactory(word_text="hello", user=user)
        UserWordFactory(word_text="hello", user=user)  # new deck via factory

    def test_srs_defaults_mark_card_as_new(self):
        word = UserWordFactory()
        assert word.ease_factor == 2.5
        assert word.interval_days == 0
        assert word.repetitions == 0
        assert word.due_at is not None
        assert word.first_reviewed_at is None  # null = new card
        assert word.last_reviewed_at is None
        assert word.enrichment_status == "pending"

    def test_db_blocks_ease_factor_below_floor(self):
        with pytest.raises(IntegrityError):
            UserWordFactory(ease_factor=1.2)


class TestCascades:
    def test_deleting_deck_cascades_user_words(self):
        word = UserWordFactory()
        word.deck.delete()
        assert not UserWord.objects.filter(pk=word.pk).exists()

    def test_deleting_word_cache_keeps_user_word(self):
        cache = WordCacheFactory(word="hello")
        word = UserWordFactory(word_text="hello", word_cache=cache)

        cache.delete()
        word.refresh_from_db()

        assert word.word_cache is None  # SET_NULL: the user's copy survives

    def test_word_cache_word_is_globally_unique(self):
        WordCacheFactory(word="hello")
        with pytest.raises(IntegrityError):
            WordCacheFactory(word="hello")
