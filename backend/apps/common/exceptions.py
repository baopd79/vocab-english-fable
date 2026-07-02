"""Project-wide DRF exception handling.

Every error response has the shape {"detail": str, "code": str}, plus
"errors": {field: [...]} for validation errors (SPEC §10). Frontend branches
on "code", never on the human-readable message.
"""

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc: Exception, context: dict) -> Response | None:
    response = drf_exception_handler(exc, context)
    if response is None:  # non-API exception: let Django produce a 500
        return None

    if isinstance(exc, exceptions.ValidationError):
        response.data = {
            "detail": "Invalid input.",
            "code": "validation_error",
            "errors": response.data,
        }
        return response

    data = response.data
    if isinstance(data, dict) and "detail" in data:
        # Plain DRF exceptions carry the code on the ErrorDetail; simplejwt's
        # InvalidToken already puts a "code" key in the payload.
        detail = data["detail"]
        code = data.get("code") or getattr(detail, "code", None) or "error"
        response.data = {"detail": str(detail), "code": str(code)}
    else:
        response.data = {"detail": "Request failed.", "code": "error"}
    return response
