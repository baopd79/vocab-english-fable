"""GET/PATCH /me/settings (SPEC §6, §9) + the settings→queue link (criterion #6)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.accounts.models import User
from apps.srs.selectors import build_review_queue
from apps.vocab.factories import UserWordFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/settings"


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


def test_get_returns_settings_creating_defaults_if_missing(client):
    # No UserSettings row exists yet; GET must materialize the defaults.
    response = client.get(URL)
    assert response.status_code == 200
    assert response.json() == {
        "new_words_per_day": 10,
        "max_reviews_per_day": 200,
        "timezone": "Asia/Ho_Chi_Minh",
    }


def test_patch_updates_settings(client, user):
    UserSettingsFactory(user=user)
    response = client.patch(
        URL,
        {"new_words_per_day": 25, "max_reviews_per_day": 300, "timezone": "Asia/Tokyo"},
        format="json",
    )
    assert response.status_code == 200
    body = response.json()
    assert body["new_words_per_day"] == 25
    assert body["timezone"] == "Asia/Tokyo"
    user.settings.refresh_from_db()
    assert user.settings.max_reviews_per_day == 300


def test_patch_is_partial(client, user):
    UserSettingsFactory(user=user, new_words_per_day=10, max_reviews_per_day=200)
    response = client.patch(URL, {"new_words_per_day": 5}, format="json")
    assert response.status_code == 200
    user.settings.refresh_from_db()
    assert user.settings.new_words_per_day == 5
    assert user.settings.max_reviews_per_day == 200  # untouched


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"new_words_per_day": 101}, "new_words_per_day"),
        ({"new_words_per_day": -1}, "new_words_per_day"),
        ({"max_reviews_per_day": 1001}, "max_reviews_per_day"),
        ({"max_reviews_per_day": -1}, "max_reviews_per_day"),
        ({"timezone": "Mars/Phobos"}, "timezone"),
        ({"timezone": "asia/ho_chi_minh"}, "timezone"),  # wrong case → invalid
    ],
)
def test_patch_out_of_bounds_is_400_with_code(client, user, payload, field):
    UserSettingsFactory(user=user)
    response = client.patch(URL, payload, format="json")
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "validation_error"
    assert field in body["errors"]


def test_settings_require_authentication():
    assert APIClient().get(URL).status_code == 401


def test_changing_new_words_per_day_changes_the_queue(client, user):
    """Criterion #6: a settings change is reflected by the review queue."""
    UserSettingsFactory(user=user, new_words_per_day=1, max_reviews_per_day=0)
    for _ in range(3):
        UserWordFactory(user=user, first_reviewed_at=None)

    now = timezone.now() + timedelta(hours=1)  # avoid same-day new_done edge
    assert len(build_review_queue(user=user, now=now).new) == 1  # capped at 1

    client.patch(URL, {"new_words_per_day": 3}, format="json")

    # Reload the user so the cached settings relation reflects the update
    # (a fresh request would load it anew in production).
    fresh_user = User.objects.get(pk=user.pk)
    assert len(build_review_queue(user=fresh_user, now=now).new) == 3  # now 3 available
