"""Shared abstract models."""

from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base adding created_at/updated_at — project-wide convention (SPEC §5)."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
