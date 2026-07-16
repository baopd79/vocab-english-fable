"""Convert an Anki .apkg export into the starter-deck JSON (SPEC §17.3-Q3).

Offline, stdlib-only tooling for the app owner — NOT a runtime dependency.
Reads the legacy `collection.anki2` SQLite inside the .apkg zip, maps the
"4000Book1" note type onto our word fields, and writes a JSON draft. Only
hard-to-protect material is taken from the source (word, short VI gloss, IPA,
part of speech); the book's definitions/examples are deliberately dropped —
`example_en`/`example_vi` start empty and are authored separately.

Usage:
    python scripts/apkg_to_starter_json.py content/<file>.apkg content/book1.base.json
"""

import html
import json
import re
import sqlite3
import sys
import tempfile
import unicodedata
import zipfile
from pathlib import Path

FIELD_SEP = "\x1f"
# Column order of the "4000Book1" note type (see notes in docs: №, Keyword,
# Suggestion, Short Vietnamese, Keyword_Sound, Image, Transcription,
# Explanation, Meaning_Sound, Example_Sound, Full Vietnamese).
COL_NO = 0
COL_KEYWORD = 1
COL_MEANING = 3
COL_IPA = 6
COL_FULL_VI = 10

WORD_RE = re.compile(r"^[a-z][a-z' -]{0,63}$")  # apps/vocab/normalization.py mirror

# First Vietnamese POS term found in "Full Vietnamese" wins; keys ordered so
# compound terms match before their substrings.
POS_VI_TO_EN = {
    "nội động từ": "verb",
    "ngoại động từ": "verb",
    "trợ động từ": "verb",
    "động từ": "verb",
    "tính từ": "adjective",
    "danh từ": "noun",
    "phó từ": "adverb",
    "trạng từ": "adverb",
    "giới từ": "preposition",
    "liên từ": "conjunction",
    "đại từ": "pronoun",
    "thán từ": "interjection",
    "mạo từ": "article",
    "số từ": "numeral",
}


def strip_html(value: str) -> str:
    value = re.sub(r"\[sound:[^\]]*\]", "", value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_word(raw: str) -> str:
    word = unicodedata.normalize("NFC", strip_html(raw).lower())
    word = re.sub(r"\s+", " ", word).strip()
    if not WORD_RE.match(word):
        raise ValueError(f"word fails app validation: {word!r}")
    return word


def normalize_ipa(raw: str) -> str:
    """`[ə'freɪd]` → `/əˈfreɪd/` — app convention wraps IPA in slashes."""
    ipa = strip_html(raw).strip("[]/ ")
    ipa = ipa.replace("'", "ˈ").replace(":", "ː")
    return f"/{ipa}/" if ipa else ""


# 13 entries whose "Full Vietnamese" text names no POS — assigned by hand
# from their short gloss.
POS_OVERRIDES = {
    "function": "noun",
    "anymore": "adverb",
    "space": "noun",
    "demand": "noun",
    "risk": "noun",
    "process": "noun",
    "flow": "verb",
    "average": "adjective",
    "behavior": "noun",
    "range": "noun",
    "effective": "adjective",
    "share": "verb",
    "cost": "noun",
}


def part_of_speech(full_vi: str) -> str:
    """Dictionary entries list several POS; the first one mentioned is the
    primary sense, so pick by position in the text — not by mapping order."""
    text = strip_html(full_vi).lower()
    best_index, best_tag = len(text) + 1, ""
    for vi_term, en_tag in POS_VI_TO_EN.items():
        index = text.find(vi_term)
        if 0 <= index < best_index:
            best_index, best_tag = index, en_tag
    return best_tag


def convert(apkg_path: Path) -> list[dict]:
    with (
        zipfile.ZipFile(apkg_path) as z,
        tempfile.TemporaryDirectory() as tmp,
    ):
        z.extract("collection.anki2", tmp)
        con = sqlite3.connect(Path(tmp) / "collection.anki2")
        rows = con.execute("select flds from notes").fetchall()
        con.close()

    words = []
    for (flds,) in rows:
        cols = flds.split(FIELD_SEP)
        word = normalize_word(cols[COL_KEYWORD])
        words.append(
            {
                "order": int(strip_html(cols[COL_NO])),
                "word": word,
                "part_of_speech": POS_OVERRIDES.get(word) or part_of_speech(cols[COL_FULL_VI]),
                "ipa": normalize_ipa(cols[COL_IPA]),
                "meaning_vi": strip_html(cols[COL_MEANING]),
                "example_en": "",
                "example_vi": "",
            }
        )
    words.sort(key=lambda w: w["order"])

    seen = set()
    for w in words:
        if w["word"] in seen:
            raise ValueError(f"duplicate word: {w['word']}")
        seen.add(w["word"])
    return words


def main() -> None:
    apkg, out = Path(sys.argv[1]), Path(sys.argv[2])
    words = convert(apkg)
    payload = {
        "deck": {
            "name": "4000 Essential Words — Book 1",
            "description": "600 từ vựng nền tảng (Book 1), sắp xếp từ dễ đến khó.",
        },
        "words": words,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing_pos = sum(1 for w in words if not w["part_of_speech"])
    missing_ipa = sum(1 for w in words if not w["ipa"])
    missing_meaning = sum(1 for w in words if not w["meaning_vi"])
    print(
        f"{len(words)} words -> {out}\n"
        f"missing: pos={missing_pos} ipa={missing_ipa} meaning={missing_meaning}"
    )


if __name__ == "__main__":
    main()
