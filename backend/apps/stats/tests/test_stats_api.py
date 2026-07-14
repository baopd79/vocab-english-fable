"""Stats endpoints (GET /stats/overview, /stats/daily) — SPEC §7."""

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.srs.factories import ReviewLogFactory
from apps.vocab.factories import UserWordFactory

pytestmark = pytest.mark.django_db

OVERVIEW = "/api/v1/stats/overview"
DAILY = "/api/v1/stats/daily"
HEATMAP = "/api/v1/stats/heatmap"


@pytest.fixture
def user():
    user = UserFactory()
    UserSettingsFactory(user=user, timezone="Asia/Ho_Chi_Minh")
    return user


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


def test_overview_shape_and_values(client, user):
    UserWordFactory(user=user, first_reviewed_at=None)  # new
    reviewed = UserWordFactory(user=user, first_reviewed_at=timezone.now(), interval_days=30)
    ReviewLogFactory(user=user, user_word=reviewed, reviewed_at=timezone.now())

    response = client.get(OVERVIEW)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"new", "learning", "mastered", "streak", "reviewed_today"}
    assert body["new"] == 1
    assert body["mastered"] == 1
    assert body["learning"] == 0
    assert body["reviewed_today"] == 1
    assert body["streak"] == 1


def test_daily_returns_requested_number_of_days(client):
    response = client.get(DAILY, {"days": 7})
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 7
    assert set(results[0]) == {"date", "count"}
    # Oldest first, contiguous dates.
    dates = [r["date"] for r in results]
    assert dates == sorted(dates)


def test_daily_defaults_to_30_days(client):
    response = client.get(DAILY)
    assert response.status_code == 200
    assert len(response.json()["results"]) == 30


@pytest.mark.parametrize("days", ["0", "366", "-1", "abc"])
def test_daily_rejects_invalid_days(client, days):
    response = client.get(DAILY, {"days": days})
    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "validation_error"
    assert "days" in body["errors"]


def test_heatmap_returns_a_year_of_days(client, user):
    card = UserWordFactory(user=user)
    ReviewLogFactory(user=user, user_word=card, reviewed_at=timezone.now())
    ReviewLogFactory(user=user, user_word=card, reviewed_at=timezone.now())

    response = client.get(HEATMAP)

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 365
    assert set(results[0]) == {"date", "count"}
    dates = [r["date"] for r in results]
    assert dates == sorted(dates)
    # Both reviews of the same card count ("số lượt ôn", not distinct cards).
    assert results[-1]["count"] == 2


def test_stats_require_authentication():
    assert APIClient().get(OVERVIEW).status_code == 401
    assert APIClient().get(DAILY).status_code == 401
    assert APIClient().get(HEATMAP).status_code == 401
