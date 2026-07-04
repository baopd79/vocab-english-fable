"""Serializers for the stats endpoints — output shape + query validation."""

from rest_framework import serializers


class StatsOverviewSerializer(serializers.Serializer):
    new = serializers.IntegerField()
    learning = serializers.IntegerField()
    mastered = serializers.IntegerField()
    streak = serializers.IntegerField()
    reviewed_today = serializers.IntegerField()


class DailyPointSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()


class StatsDailySerializer(serializers.Serializer):
    results = DailyPointSerializer(many=True)


class DailyQuerySerializer(serializers.Serializer):
    # SPEC §7: cap the window so the endpoint can't be asked for an unbounded range.
    days = serializers.IntegerField(min_value=1, max_value=365, default=30)
