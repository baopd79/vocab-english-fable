"""Deterministic provider for dev and tests — no API key, no network."""

from apps.enrichment.providers.base import WordEnrichment


class FakeProvider:
    def enrich_word(self, word: str) -> WordEnrichment:
        return WordEnrichment(
            part_of_speech="noun",
            ipa=f"/{word}/",
            meaning_vi=f"nghĩa giả của từ '{word}'",
            example_en=f"This is a fake example sentence using the word {word}.",
            example_vi=f"Đây là câu ví dụ giả dùng từ {word}.",
        )
