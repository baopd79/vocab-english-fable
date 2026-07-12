"""Serializers for the review endpoints — input validation and output shape."""

from rest_framework import serializers

from apps.srs.engine import Rating
from apps.vocab.serializers import UserWordSerializer


class ReviewAnswerSerializer(serializers.Serializer):
    user_word_id = serializers.IntegerField()
    rating = serializers.ChoiceField(choices=[r.value for r in Rating])


class DeckQueueCountSerializer(serializers.Serializer):
    """One deck's share of today's queue (pre-review overview, SPEC §17.1-B3)."""

    deck_id = serializers.IntegerField()
    deck_name = serializers.CharField()
    due_count = serializers.IntegerField()
    new_count = serializers.IntegerField()


class ReviewQueueSerializer(serializers.Serializer):
    """The two-group queue: due cards to review, then new cards to learn."""

    due = UserWordSerializer(many=True)
    new = UserWordSerializer(many=True)
    decks = DeckQueueCountSerializer(many=True)
