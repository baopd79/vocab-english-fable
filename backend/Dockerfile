# Backend image — Django + gunicorn (SPEC §13, Task 20).
# Multi-stage: deps are resolved with uv into a venv, then copied into a slim
# runtime layer that has no build tooling. The same image runs both the web
# process (default CMD) and the Celery worker (command override in compose).

FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.7 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /app

# Dependency layer first so code changes don't re-resolve packages.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project


FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app

COPY --from=builder /app/.venv /app/.venv
COPY manage.py pyproject.toml ./
COPY config ./config
COPY apps ./apps

# Admin static baked into the image; whitenoise serves it (no Nginx static
# block). Uses prod settings — no DB access happens during collectstatic.
RUN python manage.py collectstatic --no-input && chown -R app:app /app/staticfiles

USER app

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
