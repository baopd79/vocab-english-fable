"""Serializers for the accounts app — input validation and output shaping only."""

from rest_framework import serializers

from .models import User


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField(max_length=4096)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "display_name", "avatar_url"]
        read_only_fields = fields
