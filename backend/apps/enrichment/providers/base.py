"""Provider contract for AI word enrichment (SPEC §6.1).

Business logic depends only on `AIProvider` and `WordEnrichment`; swapping the
AI vendor means adding a provider class and changing the `AI_PROVIDER` env var.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class WordEnrichment:
    part_of_speech: str
    ipa: str
    meaning_vi: str
    example_en: str
    example_vi: str


class EnrichmentError(Exception):
    """The provider could not produce a valid enrichment (API failure or
    a response that does not pass schema/length validation). The caller
    (Celery task, Task 11) treats this as retryable."""


class AIProvider(Protocol):
    def enrich_word(self, word: str) -> WordEnrichment: ...
