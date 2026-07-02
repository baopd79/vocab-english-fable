"""Validation tests for account models (SPEC §5, §9)."""

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.accounts.models import UserSettings

pytestmark = pytest.mark.django_db


class TestUserConstraints:
    def test_email_must_be_unique(self):
        UserFactory(email="dup@example.com")
        with pytest.raises(IntegrityError):
            UserFactory(email="dup@example.com")

    def test_google_sub_must_be_unique(self):
        UserFactory(google_sub="sub-1")
        with pytest.raises(IntegrityError):
            UserFactory(google_sub="sub-1")

    def test_google_sub_nullable_for_admin_created_accounts(self):
        UserFactory(google_sub=None)
        UserFactory(google_sub=None)  # multiple NULLs allowed


class TestUserSettingsValidation:
    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("new_words_per_day", -1),
            ("new_words_per_day", 101),
            ("max_reviews_per_day", -1),
            ("max_reviews_per_day", 1001),
        ],
    )
    def test_out_of_bounds_rejected(self, field, value):
        settings = UserSettings(user=UserFactory(), **{field: value})
        with pytest.raises(ValidationError) as exc_info:
            settings.full_clean()
        assert field in exc_info.value.error_dict

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("new_words_per_day", 0),
            ("new_words_per_day", 100),
            ("max_reviews_per_day", 0),
            ("max_reviews_per_day", 1000),
        ],
    )
    def test_boundary_values_accepted(self, field, value):
        settings = UserSettings(user=UserFactory(), **{field: value})
        settings.full_clean()

    @pytest.mark.parametrize("value", ["Mars/Olympus", "GMT+7", "asia/ho_chi_minh", ""])
    def test_invalid_timezone_rejected(self, value):
        settings = UserSettings(user=UserFactory(), timezone=value)
        with pytest.raises(ValidationError) as exc_info:
            settings.full_clean()
        assert "timezone" in exc_info.value.error_dict

    @pytest.mark.parametrize("value", ["Asia/Ho_Chi_Minh", "UTC", "America/New_York"])
    def test_valid_timezone_accepted(self, value):
        settings = UserSettings(user=UserFactory(), timezone=value)
        settings.full_clean()

    def test_db_check_constraint_blocks_out_of_range_writes(self):
        # Defense in depth: even code that skips full_clean() cannot persist bad data.
        with pytest.raises(IntegrityError):
            UserSettingsFactory(new_words_per_day=101)
