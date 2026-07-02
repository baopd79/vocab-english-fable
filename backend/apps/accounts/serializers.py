"""Serializers for the accounts app — input validation and output shaping only."""

from rest_framework import serializers

from .models import User


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
