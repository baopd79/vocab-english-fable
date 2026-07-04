"""Stats endpoints. Thin views: validate query, call selectors, shape output."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.stats import selectors
from apps.stats.serializers import (
    DailyQuerySerializer,
    StatsDailySerializer,
    StatsOverviewSerializer,
)


class StatsOverviewView(APIView):
    @extend_schema(responses=StatsOverviewSerializer)
    def get(self, request: Request) -> Response:
        data = selectors.overview(user=request.user)
        return Response(StatsOverviewSerializer(data).data)


class StatsDailyView(APIView):
    @extend_schema(
        parameters=[OpenApiParameter("days", int, description="1–365, default 30")],
        responses=StatsDailySerializer,
    )
    def get(self, request: Request) -> Response:
        query = DailyQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        points = selectors.daily_reviews(user=request.user, days=query.validated_data["days"])
        return Response(StatsDailySerializer({"results": points}).data)
