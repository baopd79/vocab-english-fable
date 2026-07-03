"""Business exceptions for the vocab app (SPEC §10: carry a default_code)."""

from rest_framework import status
from rest_framework.exceptions import APIException


class DeckNameConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "A deck with this name already exists."
    default_code = "deck_name_conflict"
