"""Validation schema for AI output (SPEC §9).

Model output is untrusted data that lands in the shared WordCache, so every
field is length-checked here; anything over the limit is rejected (the task
retries — never silently truncated into the cache). The same limits apply to
user edits of content fields via PATCH /words/{id} (Task 12).
"""

from pydantic import BaseModel, ConfigDict, Field

MAX_PART_OF_SPEECH = 50
MAX_IPA = 100
MAX_MEANING_VI = 500
MAX_EXAMPLE = 1000


class WordEnrichmentSchema(BaseModel):
    """Shape the AI must return; also sent to Gemini as the response schema."""

    model_config = ConfigDict(str_strip_whitespace=True)

    part_of_speech: str = Field(min_length=1, max_length=MAX_PART_OF_SPEECH)
    ipa: str = Field(min_length=1, max_length=MAX_IPA)
    meaning_vi: str = Field(min_length=1, max_length=MAX_MEANING_VI)
    example_en: str = Field(min_length=1, max_length=MAX_EXAMPLE)
    example_vi: str = Field(min_length=1, max_length=MAX_EXAMPLE)
