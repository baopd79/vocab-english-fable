"""Serializers for the review endpoints — input validation and output shape."""

from rest_framework import serializers

from apps.srs.engine import Rating
from apps.vocab.serializers import UserWordSerializer


class ReviewAnswerSerializer(serializers.Serializer):
    user_word_id = serializers.IntegerField()
    rating = serializers.ChoiceField(choices=[r.value for r in Rating])


class ReviewQueueSerializer(serializers.Serializer):
    """The two-group queue: due cards to review, then new cards to learn."""

    due = UserWordSerializer(many=True)
    new = UserWordSerializer(many=True)
