"""Minimal .env loader — avoids an extra dependency for a simple need.

Reads KEY=VALUE lines from the repository root .env file into os.environ.
Variables already present in the environment are never overridden.
"""

import os
from pathlib import Path


def load_dotenv() -> None:
    env_file = Path(__file__).resolve().parents[2] / ".env"
    if not env_file.exists():
        return
    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())
