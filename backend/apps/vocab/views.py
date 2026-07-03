"""Deck endpoints. Thin views: validate input, call service/selector, shape response."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.pagination import DefaultPagination

from . import selectors, services
from .models import Deck
from .serializers import DeckSerializer


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
