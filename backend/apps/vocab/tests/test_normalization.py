"""Tests for word normalization (SPEC §6.5). Pure function — no DB needed."""

import pytest

from apps.vocab.normalization import InvalidWordError, normalize_word


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("hello", "hello"),
        ("Hello", "hello"),  # lowercase
        ("  hello  ", "hello"),  # trim
        ("ice   cream", "ice cream"),  # collapse consecutive spaces
        ("  Give\tUP  ", "give up"),  # any whitespace collapses to one space
        ("mother-in-law", "mother-in-law"),  # hyphen allowed
        ("don't", "don't"),  # apostrophe allowed
        ("a" * 64, "a" * 64),  # boundary: 64 chars is valid
    ],
)
def test_normalizes_valid_input(raw, expected):
    assert normalize_word(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "'start",  # must start with a letter
        "-dash",
        "words123",  # digits rejected
        "über",  # non a-z letters rejected
        "café",
        "café",  # NFC composes e+◌́ into é → rejected consistently
        "xin chào",
        "a" * 65,  # boundary: 65 chars is too long
        "hello!",
    ],
)
def test_rejects_invalid_input(raw):
    with pytest.raises(InvalidWordError):
        normalize_word(raw)


def test_normalization_applies_before_length_check():
    # 70 chars of padding around a valid word must still pass.
    assert normalize_word("   hello   " + " " * 60) == "hello"
