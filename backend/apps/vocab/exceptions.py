"""Business exceptions for the vocab app (SPEC §10: carry a default_code)."""

from rest_framework import status
from rest_framework.exceptions import APIException


class DeckNameConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "A deck with this name already exists."
    default_code = "deck_name_conflict"


class InvalidWord(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "Not a valid English word after normalization."
    default_code = "invalid_word"


class WordConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This word is already in the deck."
    default_code = "word_conflict"


class EnrichmentNotFailed(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Enrichment can only be retried for failed words."
    default_code = "enrichment_not_failed"


class AIBudgetExhausted(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "The system-wide AI budget for today is exhausted."
    default_code = "ai_budget_exceeded"
