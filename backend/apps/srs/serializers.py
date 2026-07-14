"""Serializers for the review endpoints — input validation and output shape."""

from rest_framework import serializers

from apps.srs.engine import Rating
from apps.srs.models import ReviewLog
from apps.vocab.serializers import UserWordSerializer


class ReviewAnswerSerializer(serializers.Serializer):
    user_word_id = serializers.IntegerField()
    rating = serializers.ChoiceField(choices=[r.value for r in Rating])
    # Which form asked the word (SPEC §17.2-10) — metadata for ReviewLog/stats;
    # it never changes how SM-2 grades the answer.
    mode = serializers.ChoiceField(choices=ReviewLog.Mode.choices, default=ReviewLog.Mode.CLASSIC)


class ReviewQueueItemSerializer(UserWordSerializer):
    """A queue card: the word plus how this review asks it (SPEC §17.3-Q1).
    Both fields are annotated onto the UserWord by the queue selector."""

    review_mode = serializers.CharField()
    mcq_choices = serializers.ListField(child=serializers.CharField(), allow_null=True)

    class Meta(UserWordSerializer.Meta):
        fields = [*UserWordSerializer.Meta.fields, "review_mode", "mcq_choices"]
        read_only_fields = fields


class DeckQueueCountSerializer(serializers.Serializer):
    """One deck's share of today's queue (pre-review overview, SPEC §17.1-B3)."""

    deck_id = serializers.IntegerField()
    deck_name = serializers.CharField()
    due_count = serializers.IntegerField()
    new_count = serializers.IntegerField()


class ReviewQueueSerializer(serializers.Serializer):
    """The two-group queue: due cards to review, then new cards to learn."""

    due = ReviewQueueItemSerializer(many=True)
    new = ReviewQueueItemSerializer(many=True)
    decks = DeckQueueCountSerializer(many=True)
