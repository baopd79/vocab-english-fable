"""API tests for the auth endpoints (SPEC §6.6, §7, §9).

Google token verification is mocked at the service boundary — tests exercise
everything from the HTTP layer down except the actual call to Google.
"""

from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User

pytestmark = pytest.mark.django_db

VERIFY_PATH = "apps.accounts.services.id_token.verify_oauth2_token"

GOOGLE_CLAIMS = {
    "sub": "google-sub-123",
    "email": "learner@example.com",
    "email_verified": True,
    "name": "Learner One",
    "picture": "https://lh3.googleusercontent.com/a/photo.jpg",
}


@pytest.fixture
def client() -> APIClient:
    return APIClient()


def login(client: APIClient, claims: dict = GOOGLE_CLAIMS):
    with patch(VERIFY_PATH, return_value=claims):
        return client.post("/api/v1/auth/google", {"credential": "fake-google-jwt"})


class TestGoogleLogin:
    def test_first_login_creates_user_with_settings_and_sets_cookie(self, client):
        response = login(client)

        assert response.status_code == 200
        assert response.data["access"]

        cookie = response.cookies["refresh_token"]
        assert cookie.value
        assert cookie["httponly"]
        assert cookie["samesite"] == "Lax"
        assert cookie["path"] == "/api/v1/auth"

        user = User.objects.get(google_sub="google-sub-123")
        assert user.email == "learner@example.com"
        assert user.display_name == "Learner One"
        assert user.settings.new_words_per_day == 10

    def test_second_login_reuses_user_and_refreshes_profile(self, client):
        login(client)
        updated = {**GOOGLE_CLAIMS, "name": "Learner Renamed"}

        response = login(client, claims=updated)

        assert response.status_code == 200
        assert User.objects.count() == 1
        assert User.objects.get().display_name == "Learner Renamed"

    def test_invalid_google_token_returns_401_with_code(self, client):
        with patch(VERIFY_PATH, side_effect=ValueError("bad token")):
            response = client.post("/api/v1/auth/google", {"credential": "tampered"})

        assert response.status_code == 401
        assert response.data == {
            "detail": "Google ID token is invalid or expired.",
            "code": "invalid_google_token",
        }
        assert User.objects.count() == 0

    def test_unverified_email_rejected(self, client):
        claims = {**GOOGLE_CLAIMS, "email_verified": False}

        response = login(client, claims=claims)

        assert response.status_code == 401
        assert response.data["code"] == "invalid_google_token"

    def test_missing_credential_returns_validation_error_format(self, client):
        response = client.post("/api/v1/auth/google", {})

        assert response.status_code == 400
        assert response.data["detail"] == "Invalid input."
        assert response.data["code"] == "validation_error"
        assert "credential" in response.data["errors"]


class TestRefresh:
    def test_rotation_returns_new_access_and_new_cookie(self, client):
        old_refresh = login(client).cookies["refresh_token"].value

        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == 200
        assert response.data["access"]
        new_refresh = response.cookies["refresh_token"].value
        assert new_refresh and new_refresh != old_refresh

    def test_rotated_out_token_is_blacklisted(self, client):
        old_refresh = login(client).cookies["refresh_token"].value
        client.post("/api/v1/auth/refresh")  # rotates, blacklisting old_refresh

        client.cookies["refresh_token"] = old_refresh
        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == 401
        assert response.data["code"] == "token_not_valid"

    def test_missing_cookie_returns_401_with_code(self, client):
        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == 401
        assert response.data["code"] == "refresh_cookie_missing"

    def test_garbage_cookie_returns_401(self, client):
        client.cookies["refresh_token"] = "not-a-jwt"

        response = client.post("/api/v1/auth/refresh")

        assert response.status_code == 401
        assert response.data["code"] == "token_not_valid"


class TestLogout:
    def test_logout_blacklists_refresh_and_clears_cookie(self, client):
        refresh = login(client).cookies["refresh_token"].value

        response = client.post("/api/v1/auth/logout")

        assert response.status_code == 204
        assert response.cookies["refresh_token"].value == ""

        client.cookies["refresh_token"] = refresh
        assert client.post("/api/v1/auth/refresh").status_code == 401

    def test_logout_without_cookie_is_idempotent(self, client):
        assert client.post("/api/v1/auth/logout").status_code == 204


class TestMe:
    def test_returns_profile_for_authenticated_user(self, client):
        access = login(client).data["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        response = client.get("/api/v1/me")

        assert response.status_code == 200
        assert response.data["email"] == "learner@example.com"
        assert response.data["display_name"] == "Learner One"
        assert response.data["avatar_url"] == GOOGLE_CLAIMS["picture"]

    def test_requires_authentication(self, client):
        response = client.get("/api/v1/me")

        assert response.status_code == 401
        assert response.data["code"] == "not_authenticated"

    def test_rejects_expired_or_garbage_access_token(self, client):
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-jwt")

        response = client.get("/api/v1/me")

        assert response.status_code == 401
        assert response.data["code"] == "token_not_valid"


class TestAuthThrottle:
    """SPEC §17.1-A2 — anonymous auth endpoints share a tight per-IP budget."""

    @pytest.fixture
    def auth_throttle_3_per_hour(self):
        """DRF reads THROTTLE_RATES from the class at import time, so patch the
        class, not settings (same pattern as the enrichment throttle tests)."""
        from django.core.cache import cache
        from rest_framework.throttling import SimpleRateThrottle

        original = SimpleRateThrottle.THROTTLE_RATES
        SimpleRateThrottle.THROTTLE_RATES = {"user": None, "enrichment": None, "auth": "3/hour"}
        cache.clear()
        yield
        SimpleRateThrottle.THROTTLE_RATES = original
        cache.clear()

    def test_auth_endpoints_throttle_by_ip(self, client, auth_throttle_3_per_hour):
        # Cookie-less refresh is a cheap 401, but it still burns the budget.
        for _ in range(3):
            assert client.post("/api/v1/auth/refresh").status_code == 401

        response = client.post("/api/v1/auth/refresh")
        assert response.status_code == 429
        assert response.data["code"] == "throttled"

        # One shared scope: login from the same IP is blocked too.
        assert login(client).status_code == 429

    def test_auth_rate_is_far_below_user_rate_in_real_settings(self):
        from config.settings.base import REST_FRAMEWORK as base_rf

        assert base_rf["DEFAULT_THROTTLE_RATES"]["auth"] == "60/hour"
