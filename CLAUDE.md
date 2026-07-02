# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vocab English — AI-integrated English vocabulary learning web app for Vietnamese users (Google login, decks, AI word enrichment via Gemini, SM-2 spaced repetition, stats). Solo-dev project, self-hosted on a VPS.

- **SPEC.md is the authoritative spec** (Vietnamese). Section numbers referenced in code comments (e.g. "SPEC §6.6") point there. Update SPEC.md when a design decision changes.
- Work proceeds task-by-task per `tasks/plan.md` (22 tasks, 6 phases) with the checklist in `tasks/todo.md`. Finish and verify one task before starting the next; the user gives explicit go-aheads and prefers discussing decisions (via questions) before code is written.
- The user is learning Django (FastAPI background). After each task, append to the "Nhật ký theo task" section of `docs/django-guide.md`: what the task did, which Django concepts appeared for the first time, and which files to read — in Vietnamese, referencing real files.
- Convention: code + docstrings in English; project docs and user communication in Vietnamese.
- Commits: no `Co-Authored-By` trailer. Push to `main` triggers CI (`.github/workflows/ci.yml`, backend + frontend jobs).

## Commands

```bash
docker compose -f docker-compose.dev.yml up -d   # dev infra: Postgres 16 + Redis (required for backend tests)

# Backend (cd backend/) — Python via uv, never pip
uv sync
uv run python manage.py migrate
uv run python manage.py runserver                # :8000
uv run pytest                                    # full suite + coverage (fail_under=70)
uv run pytest apps/accounts/tests/test_auth_api.py -k rotation --no-cov   # single test, skip coverage
uv run ruff check --fix . && uv run ruff format .

# Frontend (cd frontend/) — pnpm 11
pnpm dev                                         # :3000, proxies /api → :8000 via next.config.ts rewrites
pnpm test                                        # vitest run
pnpm vitest run src/components/health-check.test.tsx   # single file
pnpm lint && pnpm format:check
pnpm build
```

Ruff is the only Python checker (no mypy), but full type hints are still required. Migrations are excluded from ruff.

API docs (dev only, `DEBUG=true`): Swagger UI at `http://localhost:8000/api/docs/` (drf-spectacular) and DRF's browsable API on every endpoint. New `APIView` methods need an `@extend_schema` annotation or they are dropped from the schema.

## Architecture

Monorepo: `backend/` (Django 5 + DRF, Python 3.13 venv at `backend/.venv`) and `frontend/` (Next.js 16 App Router, TS strict, TanStack Query, Tailwind 4). FE and BE are **same-origin by design** — Next.js rewrites in dev, Nginx single domain in prod — so there is no CORS config and the auth cookie just works. Never call `localhost:8000` directly from frontend code; always go through `/api`.

### Backend layering (SPEC §10 — enforced, not aspirational)

```
View (thin: auth, permission, call service/selector, shape response)
  → Serializer (input validation + output shape only)
  → services.py (ALL writes; verb-first names; each function = one @transaction.atomic)
  → selectors.py (reads with logic: queue, stats; views may ORM directly only for get-by-id filtered by user)
  → Model (schema + constraints only)
apps/srs/engine.py = pure SM-2 domain logic: no Django imports, must stay at 100% test coverage
```

- Views never call `.save()`; Celery tasks are thin wrappers around services.
- Cross-app: reading another app's models is fine; writing goes through that app's service.
- Each app keeps the same file set: `models.py · serializers.py · views.py · urls.py · services.py · selectors.py · tasks.py · factories.py · tests/`.
- All models inherit `apps.common.models.TimeStampedModel`. Datetimes are stored UTC; convert to `UserSettings.timezone` only when computing "days" (queue, streak, stats).

### Error contract

`apps/common/exceptions.api_exception_handler` (wired in `REST_FRAMEWORK`) normalizes every error to `{"detail", "code"}` plus `"errors": {field: [...]}` for validation. The frontend branches on `code`, never on message text. Business exceptions subclass `APIException` with a `default_code` (e.g. `invalid_google_token`, `deck_name_conflict`).

**Gotcha:** DRF downgrades `AuthenticationFailed`/`NotAuthenticated` from 401 to 403 on views with `authentication_classes = []`. The auth views intentionally have no authenticator, so their exceptions (`apps/accounts/exceptions.py`) subclass `APIException` directly with `status_code = 401`.

### Auth flow (SPEC §6.6)

Google Identity Services popup on the frontend → ID token → `POST /api/v1/auth/google` → server-side verification with google-auth (signature + audience; identity claims come only from the verified token, never the request body) → simplejwt pair. Access token: 15 min, returned in body, kept in memory by FE. Refresh token: 7 days, httpOnly SameSite=Lax cookie scoped to `path=/api/v1/auth`, rotation + blacklist on refresh and logout. `401 + code=token_not_valid` from any endpoint means the session is dead → go to login.

`accounts.User` is a custom user model (`AUTH_USER_MODEL`) keyed to Google by unique nullable `google_sub`; users get a `UserSettings` row via the idempotent `create_user_settings` service called on every login.

### Core domain rules to not break

- **Never trust client data** (SPEC §9): word normalization (`trim → lowercase → NFC → collapse spaces`, regex `^[a-z][a-z' -]{0,63}$`), bounds on settings, SRS fields read-only via API, every URL id filtered by `request.user` (404, not 403, for other users' objects).
- **WordCache enrichment** (SPEC §6.1): global cache with pending/processing/completed/failed; claims are atomic status transitions; the AI call happens **outside any DB transaction**; failed-as-miss.
- **SM-2** (SPEC §6.2): ceil rounding, Easy on new card = 4d, Again → interval 0 / due +10min / reps 0, EF floor 1.3.

### Config & env

Settings: `config/settings/{base,dev,prod}.py`; pytest runs with `dev`. Env vars load from `backend/.env` via the minimal loader `config/env.py` (no python-dotenv dep); frontend uses `frontend/.env.local` (Next.js convention). Both are gitignored and hold real secrets — never commit them; `.env.example` files carry placeholders. `.vscode/settings.json` (local-only) pins the interpreter to `backend/.venv`.

### Testing

Backend: pytest + pytest-django + factory-boy (factories live in each app's `factories.py`). External boundaries are mocked at the service edge (e.g. `apps.accounts.services.id_token.verify_oauth2_token`); the AI provider has a `FakeProvider` for dev/tests. Frontend: Vitest + React Testing Library + jest-dom (`vitest.config.ts`, jsdom).
