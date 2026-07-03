"""Serializers for the vocab app — input validation and output shaping only."""

from rest_framework import serializers

from .models import Deck


class DeckSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deck
        fields = ["id", "name", "description", "visibility", "created_at", "updated_at"]
        # visibility stays private until the sharing feature ships; SRS/audit
        # fields are never client-writable.
        read_only_fields = ["id", "visibility", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name must not be empty.")
        return name
