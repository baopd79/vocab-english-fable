"""Celery application — configured from Django settings (CELERY_* namespace).

Run a dev worker with:
    uv run celery -A config worker -l info
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("vocab")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
