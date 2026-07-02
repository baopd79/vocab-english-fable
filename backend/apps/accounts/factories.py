"""Test factories for account models."""

import factory
from factory.django import DjangoModelFactory

from .models import User, UserSettings


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    email = factory.LazyAttribute(lambda obj: f"{obj.username}@example.com")
    google_sub = factory.Sequence(lambda n: f"google-sub-{n}")
    display_name = "Test User"


class UserSettingsFactory(DjangoModelFactory):
    class Meta:
        model = UserSettings

    user = factory.SubFactory(UserFactory)
