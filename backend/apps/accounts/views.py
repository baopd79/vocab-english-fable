"""Auth and profile endpoints. Thin views: validate input, call services, shape response."""

import contextlib

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .exceptions import InvalidRefreshToken, RefreshCookieMissing
from .serializers import (
    AccessTokenSerializer,
    GoogleAuthSerializer,
    UserSerializer,
    UserSettingsSerializer,
)
from .services import authenticate_google_user, create_user_settings, update_user_settings

REFRESH_COOKIE_NAME = "refresh_token"
# Scoped so the browser only ever sends the refresh token to the auth endpoints.
REFRESH_COOKIE_PATH = "/api/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=not settings.DEBUG,  # plain http in dev, Secure in prod
        samesite="Lax",
    )


class GoogleLoginView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(request=GoogleAuthSerializer, responses=AccessTokenSerializer, auth=[])
    def post(self, request: Request) -> Response:
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate_google_user(credential=serializer.validated_data["credential"])
        refresh = RefreshToken.for_user(user)
        response = Response({"access": str(refresh.access_token)})
        _set_refresh_cookie(response, str(refresh))
        return response


class RefreshView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(request=None, responses=AccessTokenSerializer, auth=[])
    def post(self, request: Request) -> Response:
        raw_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_token is None:
            raise RefreshCookieMissing
        serializer = TokenRefreshSerializer(data={"refresh": raw_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidRefreshToken from exc
        response = Response({"access": serializer.validated_data["access"]})
        _set_refresh_cookie(response, serializer.validated_data["refresh"])
        return response


class LogoutView(APIView):
    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(request=None, responses={204: None}, auth=[])
    def post(self, request: Request) -> Response:
        raw_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_token:
            # Expired or already-blacklisted tokens are fine — logout stays idempotent.
            with contextlib.suppress(TokenError):
                RefreshToken(raw_token).blacklist()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
        return response


class MeView(APIView):
    @extend_schema(responses=UserSerializer)
    def get(self, request: Request) -> Response:
        return Response(UserSerializer(request.user).data)


class MeSettingsView(APIView):
    @extend_schema(responses=UserSettingsSerializer)
    def get(self, request: Request) -> Response:
        # create_user_settings is idempotent — guarantees the row exists.
        settings_obj = create_user_settings(user=request.user)
        return Response(UserSettingsSerializer(settings_obj).data)

    @extend_schema(request=UserSettingsSerializer, responses=UserSettingsSerializer)
    def patch(self, request: Request) -> Response:
        settings_obj = create_user_settings(user=request.user)
        serializer = UserSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        settings_obj = update_user_settings(user_settings=settings_obj, **serializer.validated_data)
        return Response(UserSettingsSerializer(settings_obj).data)
