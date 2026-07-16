"""Seed system starter decks from apps/vocab/data/*.json (SPEC §17.2-3, Q3).

Thin wrapper per SPEC §10 — all writes live in services.seed_starter_deck.
Idempotent: safe to re-run after adding a new content file or new words.
"""

import json
from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand

from apps.vocab import services

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


class Command(BaseCommand):
    help = "Create/refresh the system starter decks (idempotent, no AI calls)."

    def handle(self, *args: Any, **options: Any) -> None:
        files = sorted(DATA_DIR.glob("*.json"))
        if not files:
            self.stdout.write(self.style.WARNING(f"no content files in {DATA_DIR}"))
            return
        for path in files:
            payload = json.loads(path.read_text(encoding="utf-8"))
            result = services.seed_starter_deck(payload=payload)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{path.name}: deck '{result['deck']}' — "
                    f"+{result['words_created']} words, +{result['cache_created']} cache rows"
                )
            )
