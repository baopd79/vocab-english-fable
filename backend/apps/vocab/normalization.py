"""Word normalization — the canonical key of WordCache (SPEC §6.5).

Pure domain logic: no Django imports, usable from serializers, services and
the SRS typing check alike.
"""

import re
import unicodedata

# After normalization: starts with a letter; letters, spaces, hyphens and
# apostrophes only; 64 chars max. Phrases ("give up", "ice cream") are allowed.
WORD_RE = re.compile(r"^[a-z][a-z' -]{0,63}$")


class InvalidWordError(ValueError):
    """Raised when input cannot be normalized into a valid word key."""


def normalize_word(raw: str) -> str:
    """Normalize user input: trim → lowercase → NFC → collapse whitespace.

    Returns the canonical form or raises InvalidWordError (SPEC: invalid input
    → 400, no UserWord is created).
    """
    text = unicodedata.normalize("NFC", raw.strip().lower())
    text = " ".join(text.split())
    if not WORD_RE.fullmatch(text):
        raise InvalidWordError(f"Not a valid word after normalization: {raw!r}")
    return text
