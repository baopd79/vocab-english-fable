"""Test factories for SRS models."""

import factory
from django.utils import timezone
from factory.django import DjangoModelFactory

from apps.vocab.factories import UserWordFactory

from .models import ReviewLog


class ReviewLogFactory(DjangoModelFactory):
    class Meta:
        model = ReviewLog

    user_word = factory.SubFactory(UserWordFactory)
    user = factory.SelfAttribute("user_word.user")
    rating = ReviewLog.Rating.GOOD
    interval_after = 1
    ease_after = 2.5
    reviewed_at = factory.LazyFunction(timezone.now)
