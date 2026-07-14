"""Review endpoints (GET /review/queue, POST /review/answer) — SPEC §6.2, §9."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.factories import UserFactory, UserSettingsFactory
from apps.srs.models import ReviewLog
from apps.vocab.factories import UserWordFactory

pytestmark = pytest.mark.django_db

ANSWER = "/api/v1/review/answer"
QUEUE = "/api/v1/review/queue"


@pytest.fixture
def user():
    user = UserFactory()
    UserSettingsFactory(user=user)  # defaults: 10 new / 200 reviews / HCM
    return user


@pytest.fixture
def client(user):
    api_client = APIClient()
    api_client.force_authenticate(user=user)
    return api_client


# --- GET /review/queue -------------------------------------------------------


def test_queue_returns_due_and_new_groups(client, user):
    due = UserWordFactory(
        user=user,
        first_reviewed_at=timezone.now() - timedelta(days=3),
        due_at=timezone.now() - timedelta(hours=1),
    )
    fresh = UserWordFactory(user=user, first_reviewed_at=None)

    response = client.get(QUEUE)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"due", "new", "decks"}
    assert [c["id"] for c in body["due"]] == [due.id]
    assert [c["id"] for c in body["new"]] == [fresh.id]
    # New cards expose first_reviewed_at=null so the UI knows to flip, not type.
    assert body["new"][0]["first_reviewed_at"] is None
    # Per-deck breakdown for the pre-review overview (SPEC §17.1-B3).
    assert {(d["deck_id"], d["due_count"], d["new_count"]) for d in body["decks"]} == {
        (due.deck_id, 1, 0),
        (fresh.deck_id, 0, 1),
    }
    assert all(d["deck_name"] for d in body["decks"])
    # Every queue item says how it wants to be asked (SPEC §17.2-10).
    for item in [*body["due"], *body["new"]]:
        assert item["review_mode"] == "classic"  # young cards stay classic
        assert item["mcq_choices"] is None


# --- POST /review/answer -----------------------------------------------------


def test_answer_applies_sm2_creates_log_and_sets_first_reviewed(client, user):
    card = UserWordFactory(
        user=user, ease_factor=2.5, interval_days=0, repetitions=0, first_reviewed_at=None
    )

    response = client.post(ANSWER, {"user_word_id": card.id, "rating": "good"}, format="json")

    assert response.status_code == 200
    assert response.json()["repetitions"] == 1
    card.refresh_from_db()
    assert card.repetitions == 1
    assert card.interval_days == 1
    assert card.first_reviewed_at is not None
    assert card.last_reviewed_at is not None
    assert card.due_at > timezone.now()
    log = ReviewLog.objects.get(user_word=card)
    assert log.rating == "good"
    assert log.interval_after == 1
    assert log.ease_after == pytest.approx(2.5)


def test_again_does_not_reset_first_reviewed_at(client, user):
    first = timezone.now() - timedelta(days=2)
    card = UserWordFactory(
        user=user, first_reviewed_at=first, repetitions=3, interval_days=6, ease_factor=2.5
    )

    response = client.post(ANSWER, {"user_word_id": card.id, "rating": "again"}, format="json")

    assert response.status_code == 200
    card.refresh_from_db()
    assert card.first_reviewed_at == first  # set once, never reset
    assert card.repetitions == 0  # Again resets reps
    assert card.due_at < timezone.now() + timedelta(minutes=11)  # ~10 min out


def test_answer_accepts_card_not_yet_due(client, user):
    card = UserWordFactory(
        user=user,
        first_reviewed_at=timezone.now() - timedelta(days=1),
        due_at=timezone.now() + timedelta(days=5),
    )

    response = client.post(ANSWER, {"user_word_id": card.id, "rating": "good"}, format="json")

    assert response.status_code == 200  # not-due accepted for the Again flow (SPEC §9)


def test_answer_other_users_card_is_404(client):
    other = UserWordFactory()
    response = client.post(ANSWER, {"user_word_id": other.id, "rating": "good"}, format="json")
    assert response.status_code == 404


def test_answer_records_mode_on_the_log(client, user):
    card = UserWordFactory(user=user)

    response = client.post(
        ANSWER,
        {"user_word_id": card.id, "rating": "good", "mode": "listening"},
        format="json",
    )

    assert response.status_code == 200
    assert ReviewLog.objects.get(user_word=card).mode == "listening"


def test_answer_mode_defaults_to_classic(client, user):
    card = UserWordFactory(user=user)

    response = client.post(ANSWER, {"user_word_id": card.id, "rating": "good"}, format="json")

    assert response.status_code == 200
    assert ReviewLog.objects.get(user_word=card).mode == "classic"


def test_answer_invalid_mode_is_400(client, user):
    card = UserWordFactory(user=user)
    response = client.post(
        ANSWER, {"user_word_id": card.id, "rating": "good", "mode": "cloze"}, format="json"
    )
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_answer_invalid_rating_is_400(client, user):
    card = UserWordFactory(user=user)
    response = client.post(ANSWER, {"user_word_id": card.id, "rating": "perfect"}, format="json")
    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_answer_requires_authentication():
    card = UserWordFactory()
    response = APIClient().post(ANSWER, {"user_word_id": card.id, "rating": "good"}, format="json")
    assert response.status_code == 401
