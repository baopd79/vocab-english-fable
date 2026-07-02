"""Business exceptions for the accounts app (SPEC §10: carry a default_code).

These subclass APIException with an explicit 401 instead of DRF's
AuthenticationFailed: the auth views run with authentication_classes = [], and
DRF downgrades AuthenticationFailed to 403 when no authenticator (hence no
WWW-Authenticate header) is configured on the view.
"""

from rest_framework import status
from rest_framework.exceptions import APIException


class InvalidGoogleToken(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Google ID token is invalid or expired."
    default_code = "invalid_google_token"


class RefreshCookieMissing(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Refresh token cookie is missing."
    default_code = "refresh_cookie_missing"


class InvalidRefreshToken(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Refresh token is invalid or expired."
    # Same code simplejwt uses for bad access tokens, so the frontend has one
    # branch: 401 + token_not_valid → session is gone, go to login.
    default_code = "token_not_valid"
