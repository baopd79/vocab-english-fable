from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Unauthenticated liveness probe used by deploy verification and uptime checks."""

    authentication_classes: list = []
    permission_classes: list = []

    @extend_schema(responses=OpenApiTypes.OBJECT, auth=[])
    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})
