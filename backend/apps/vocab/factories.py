"""Test factories for vocab models."""

import factory
from factory.django import DjangoModelFactory

from apps.accounts.factories import UserFactory

from .models import Deck, UserWord, WordCache


class DeckFactory(DjangoModelFactory):
    class Meta:
        model = Deck

    owner = factory.SubFactory(UserFactory)
    name = factory.Sequence(lambda n: f"Deck {n}")


class WordCacheFactory(DjangoModelFactory):
    class Meta:
        model = WordCache

    word = factory.Sequence(lambda n: f"word{n}")


class UserWordFactory(DjangoModelFactory):
    class Meta:
        model = UserWord

    user = factory.SubFactory(UserFactory)
    # Deck belongs to the same user unless the test says otherwise.
    deck = factory.SubFactory(DeckFactory, owner=factory.SelfAttribute("..user"))
    word_text = factory.Sequence(lambda n: f"word{n}")
