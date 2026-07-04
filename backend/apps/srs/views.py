"""Review endpoints. Thin views: validate, call service/selector, shape output."""

from drf_spectacular.utils import extend_schema
from rest_framework.generics import get_object_or_404
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.srs import selectors, services
from apps.srs.engine import Rating
from apps.srs.serializers import ReviewAnswerSerializer, ReviewQueueSerializer
from apps.vocab.models import UserWord
from apps.vocab.serializers import UserWordSerializer


class ReviewQueueView(APIView):
    @extend_schema(responses=ReviewQueueSerializer)
    def get(self, request: Request) -> Response:
        queue = selectors.build_review_queue(user=request.user)
        return Response(ReviewQueueSerializer({"due": queue.due, "new": queue.new}).data)


class ReviewAnswerView(APIView):
    @extend_schema(request=ReviewAnswerSerializer, responses=UserWordSerializer)
    def post(self, request: Request) -> Response:
        serializer = ReviewAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Cards not yet due are accepted on purpose: the Again flow keeps a card
        # in the frontend session and answers it again before due_at (SPEC §9).
        user_word = get_object_or_404(
            UserWord, pk=serializer.validated_data["user_word_id"], user=request.user
        )
        updated = services.apply_review_answer(
            user=request.user,
            user_word=user_word,
            rating=Rating(serializer.validated_data["rating"]),
        )
        return Response(UserWordSerializer(updated).data)
