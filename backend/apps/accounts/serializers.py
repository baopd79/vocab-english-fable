"""Serializers for the accounts app — input validation and output shaping only."""

from rest_framework import serializers

from .models import User, UserSettings
from .validators import validate_timezone_name


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField(max_length=4096)


class AccessTokenSerializer(serializers.Serializer):
    """Response shape of the login/refresh endpoints (for docs; output only)."""

    access = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "display_name", "avatar_url"]
        read_only_fields = fields


class UserSettingsSerializer(serializers.ModelSerializer):
    # Explicit bounds so the API rejects out-of-range values with a clear error
    # regardless of how DRF maps the model validators (SPEC §9).
    new_words_per_day = serializers.IntegerField(min_value=0, max_value=100)
    max_reviews_per_day = serializers.IntegerField(min_value=0, max_value=1000)

    class Meta:
        model = UserSettings
        fields = ["new_words_per_day", "max_reviews_per_day", "timezone"]

    def validate_timezone(self, value: str) -> str:
        # Reuse the model validator so the API and DB agree on valid zones.
        validate_timezone_name(value)
        return value
