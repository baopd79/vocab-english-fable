"""Deck endpoints. Thin views: validate input, call service/selector, shape response."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from apps.common.pagination import DefaultPagination

from . import selectors, services
from .models import Deck, UserWord
from .serializers import (
    DeckSerializer,
    UserWordSerializer,
    UserWordUpdateSerializer,
    WordCreateSerializer,
)


class DeckListView(APIView):
    @extend_schema(responses=DeckSerializer(many=True))
    def get(self, request: Request) -> Response:
        decks = selectors.list_decks(owner=request.user)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(decks, request, view=self)
        return paginator.get_paginated_response(DeckSerializer(page, many=True).data)

    @extend_schema(request=DeckSerializer, responses=DeckSerializer)
    def post(self, request: Request) -> Response:
        serializer = DeckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        deck = services.create_deck(owner=request.user, **serializer.validated_data)
        return Response(DeckSerializer(deck).data, status=status.HTTP_201_CREATED)


class StarterDeckListView(APIView):
    @extend_schema(responses=DeckSerializer(many=True))
    def get(self, request: Request) -> Response:
        decks = selectors.list_starter_decks()
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(decks, request, view=self)
        return paginator.get_paginated_response(DeckSerializer(page, many=True).data)


class DeckCloneView(APIView):
    @extend_schema(request=None, responses=DeckSerializer)
    def post(self, request: Request, pk: int) -> Response:
        # Only starter decks are cloneable in v1.1 (Task 16 will extend this
        # to public decks); anything else — including other users' private
        # decks — stays an indistinguishable 404 (SPEC §9).
        source = get_object_or_404(Deck, pk=pk, is_starter=True)
        deck = services.clone_deck(owner=request.user, source=source)
        return Response(DeckSerializer(deck).data, status=status.HTTP_201_CREATED)


class DeckDetailView(APIView):
    def get_object(self, request: Request, pk: int) -> Deck:
        # Filtered by owner: another user's id is indistinguishable from a
        # missing one (404, not 403) — IDOR protection per SPEC §9.
        return get_object_or_404(Deck, pk=pk, owner=request.user)

    @extend_schema(responses=DeckSerializer)
    def get(self, request: Request, pk: int) -> Response:
        return Response(DeckSerializer(self.get_object(request, pk)).data)

    @extend_schema(request=DeckSerializer, responses=DeckSerializer)
    def patch(self, request: Request, pk: int) -> Response:
        deck = self.get_object(request, pk)
        serializer = DeckSerializer(deck, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        deck = services.update_deck(deck=deck, **serializer.validated_data)
        return Response(DeckSerializer(deck).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, pk: int) -> Response:
        services.delete_deck(deck=self.get_object(request, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class DeckWordListView(APIView):
    throttle_scope = "enrichment"

    def get_throttles(self) -> list[BaseThrottle]:
        # SPEC §8: the 50/day enrichment budget guards POST only (each POST
        # may trigger an AI call); GET stays on the default user throttle.
        if self.request.method == "POST":
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_deck(self, request: Request, pk: int) -> Deck:
        return get_object_or_404(Deck, pk=pk, owner=request.user)

    @extend_schema(responses=UserWordSerializer(many=True))
    def get(self, request: Request, pk: int) -> Response:
        words = selectors.list_words(deck=self.get_deck(request, pk))
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(words, request, view=self)
        return paginator.get_paginated_response(UserWordSerializer(page, many=True).data)

    @extend_schema(request=WordCreateSerializer, responses=UserWordSerializer)
    def post(self, request: Request, pk: int) -> Response:
        deck = self.get_deck(request, pk)
        serializer = WordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_word = services.create_user_word(deck=deck, word=serializer.validated_data["word"])
        return Response(UserWordSerializer(user_word).data, status=status.HTTP_201_CREATED)


class UserWordDetailView(APIView):
    throttle_scope = "enrichment"

    def get_throttles(self) -> list[BaseThrottle]:
        # A word_text change triggers re-enrichment, so it spends the
        # enrichment budget (SPEC §9) — decided on field presence, before
        # validation, so sending the field always counts.
        if self.request.method == "PATCH" and "word_text" in self.request.data:
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_object(self, request: Request, pk: int) -> UserWord:
        return get_object_or_404(UserWord, pk=pk, user=request.user)

    @extend_schema(responses=UserWordSerializer)
    def get(self, request: Request, pk: int) -> Response:
        return Response(UserWordSerializer(self.get_object(request, pk)).data)

    @extend_schema(request=UserWordUpdateSerializer, responses=UserWordSerializer)
    def patch(self, request: Request, pk: int) -> Response:
        user_word = self.get_object(request, pk)
        serializer = UserWordUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user_word = services.update_user_word(user_word=user_word, data=serializer.validated_data)
        return Response(UserWordSerializer(user_word).data)

    @extend_schema(responses={204: None})
    def delete(self, request: Request, pk: int) -> Response:
        services.delete_user_word(user_word=self.get_object(request, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)


class RetryEnrichmentView(APIView):
    throttle_classes = [ScopedRateThrottle]  # same budget as adding words (SPEC §8)
    throttle_scope = "enrichment"

    @extend_schema(request=None, responses=UserWordSerializer)
    def post(self, request: Request, pk: int) -> Response:
        user_word = get_object_or_404(UserWord, pk=pk, user=request.user)
        user_word = services.retry_enrichment(user_word=user_word)
        return Response(UserWordSerializer(user_word).data)
