"""Tests for accounts services."""

import pytest

from apps.accounts.factories import UserFactory
from apps.accounts.models import UserSettings
from apps.accounts.services import create_user_settings

pytestmark = pytest.mark.django_db


class TestCreateUserSettings:
    def test_creates_settings_with_spec_defaults(self):
        user = UserFactory()

        settings = create_user_settings(user=user)

        assert settings.new_words_per_day == 10
        assert settings.max_reviews_per_day == 200
        assert settings.timezone == "Asia/Ho_Chi_Minh"
        assert user.settings == settings

    def test_idempotent_returns_existing_row(self):
        user = UserFactory()

        first = create_user_settings(user=user)
        second = create_user_settings(user=user)

        assert first.pk == second.pk
        assert UserSettings.objects.filter(user=user).count() == 1

    def test_does_not_overwrite_customized_values(self):
        user = UserFactory()
        create_user_settings(user=user)
        UserSettings.objects.filter(user=user).update(new_words_per_day=42)

        settings = create_user_settings(user=user)

        assert settings.new_words_per_day == 42
