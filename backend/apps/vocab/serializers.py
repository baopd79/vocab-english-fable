"""Serializers for the vocab app — input validation and output shaping only."""

from rest_framework import serializers

from apps.enrichment.providers.schema import (
    MAX_EXAMPLE,
    MAX_IPA,
    MAX_MEANING_VI,
    MAX_PART_OF_SPEECH,
)
from apps.stats.selectors import MASTERED_INTERVAL_DAYS

from .models import Deck, UserWord


class DeckSerializer(serializers.ModelSerializer):
    # Read from the list_decks() annotations when present; the fallbacks cover
    # single-object paths (create, retrieve, patch) at 2 extra queries each.
    word_count = serializers.SerializerMethodField()
    mastered_count = serializers.SerializerMethodField()

    class Meta:
        model = Deck
        fields = [
            "id",
            "name",
            "description",
            "visibility",
            "is_starter",
            "source_deck",
            "word_count",
            "mastered_count",
            "created_at",
            "updated_at",
        ]
        # visibility is owner-writable (private/public — SPEC §17.2-13); starter
        # flag and clone lineage are set only by seed/clone services; SRS/audit
        # fields are never client-writable.
        read_only_fields = [
            "id",
            "is_starter",
            "source_deck",
            "created_at",
            "updated_at",
        ]

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name must not be empty.")
        return name

    def get_word_count(self, deck: Deck) -> int:
        annotated: int | None = getattr(deck, "word_count", None)
        return annotated if annotated is not None else deck.words.count()

    def get_mastered_count(self, deck: Deck) -> int:
        annotated: int | None = getattr(deck, "mastered_count", None)
        if annotated is not None:
            return annotated
        return deck.words.filter(interval_days__gte=MASTERED_INTERVAL_DAYS).count()


class PublicDeckSerializer(serializers.ModelSerializer):
    """Share-page shape (SPEC §17.3-Q4): the owner's display name — never the
    email — plus counts; no clone lineage, no timestamps."""

    owner_name = serializers.CharField(source="owner.display_name", read_only=True)
    word_count = serializers.SerializerMethodField()

    class Meta:
        model = Deck
        fields = ["id", "name", "description", "owner_name", "word_count"]
        read_only_fields = fields

    def get_word_count(self, deck: Deck) -> int:
        annotated: int | None = getattr(deck, "word_count", None)
        return annotated if annotated is not None else deck.words.count()


class PublicWordSerializer(serializers.ModelSerializer):
    """Word rows on the share page: content fields only — the owner's SRS
    progress and enrichment bookkeeping stay private (SPEC §17.3-Q4)."""

    class Meta:
        model = UserWord
        fields = [
            "id",
            "word_text",
            "part_of_speech",
            "ipa",
            "meaning_vi",
            "example_en",
            "example_vi",
        ]
        read_only_fields = fields


class UserWordSerializer(serializers.ModelSerializer):
    """Output-only shape for a word — every field is read-only; writes go
    through WordCreateSerializer / UserWordUpdateSerializer + services."""

    class Meta:
        model = UserWord
        fields = [
            "id",
            "deck",
            "word_text",
            "part_of_speech",
            "ipa",
            "meaning_vi",
            "example_en",
            "example_vi",
            "enrichment_status",
            "ease_factor",
            "interval_days",
            "repetitions",
            "due_at",
            "first_reviewed_at",
            "last_reviewed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class WordCreateSerializer(serializers.Serializer):
    # Raw user input; normalization + the §6.5 regex happen in the service.
    word = serializers.CharField(max_length=255)


class UserWordUpdateSerializer(serializers.Serializer):
    """PATCH whitelist (SPEC §9): word_text + the 5 content fields. SRS fields
    and enrichment_status are deliberately absent — clients sending them get
    silently ignored, never applied."""

    word_text = serializers.CharField(max_length=255, required=False)
    part_of_speech = serializers.CharField(
        max_length=MAX_PART_OF_SPEECH, required=False, allow_blank=True
    )
    ipa = serializers.CharField(max_length=MAX_IPA, required=False, allow_blank=True)
    meaning_vi = serializers.CharField(max_length=MAX_MEANING_VI, required=False, allow_blank=True)
    example_en = serializers.CharField(max_length=MAX_EXAMPLE, required=False, allow_blank=True)
    example_vi = serializers.CharField(max_length=MAX_EXAMPLE, required=False, allow_blank=True)
