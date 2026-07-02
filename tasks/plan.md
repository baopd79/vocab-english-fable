# Kế hoạch triển khai: Vocab English MVP

> **Nguồn:** SPEC.md Draft v2 (đã chốt 2026-07-02) · Checklist tiến độ: `tasks/todo.md`
> **Nguyên tắc:** lát cắt dọc (mỗi task một đường đi trọn vẹn), task cỡ S/M, checkpoint sau mỗi phase, rủi ro cao làm sớm.

## Context

Dự án greenfield (chưa có code, chưa `git init`). SPEC.md đã chốt đầy đủ: 7 user story, data model, SM-2, luồng enrichment, validation, kiến trúc layered (services/selectors), 11 tiêu chí nghiệm thu. Kế hoạch này bẻ spec thành 22 task thực thi được, mỗi task có acceptance criteria (AC) + cách verify + dependencies + size.

## Dependency graph

```
[P0] Repo + Django skeleton ──── [P0] Next.js skeleton ──── [P0] CI
        │
[P1] accounts models → Auth API → Login UI          (story 1)
        │
[P2] vocab models ─→ Deck API → Deck UI             (story 2)
        │       └──→ Words API → Words UI           (story 3,4)
        │              ↑
[P2] enrichment providers → enrich service/Celery ──┘
        │
[P3] SM-2 engine (thuần, song song được) → ReviewLog + queue/answer API → Review UI   (story 5)
        │
[P4] Settings API+UI (story 6) · Stats API → Stats UI (story 7)
        │
[P5] Docker prod + nginx → deploy workflow + backup → launch checklist
```

## Prerequisites (chuẩn bị ngoài code)

| Cần | Cho task | Ghi chú |
|---|---|---|
| GitHub repo | 3 (CI) | tạo khi bắt đầu |
| Google OAuth Client ID | 5–6 | console.cloud.google.com, origin localhost + domain |
| Gemini API key | checkpoint 2 | dev dùng FakeProvider được, verify thật cần key |
| Domain + VPS | 21–22 | SPEC Open Questions #2 — cần trước phase 5 |

## Task list

### Phase 0 — Nền móng

**Task 1: Khởi tạo repo + Django skeleton** (M, deps: none)
`git init`; `backend/` với uv, Django 5 + DRF, `config/settings/{base,dev,prod}.py`, ruff + pytest-django (coverage `fail_under=70`), endpoint `GET /api/v1/health`; `docker-compose.dev.yml` (Postgres 16 + Redis); `.env.example`, `.gitignore`.
- [ ] AC: compose dev up chạy Postgres + Redis
- [ ] AC: `runserver` → `GET /api/v1/health` trả 200
- [ ] AC: `uv run ruff check .` + `uv run pytest` (test health) pass
- Verify: chạy đủ các lệnh mục 3 SPEC phần backend (sync, migrate, runserver, pytest, ruff).

**Task 2: Next.js skeleton** (M, deps: 1)
`frontend/` Next.js 15 App Router, TS strict, Tailwind, TanStack Query provider, ESLint + Prettier, Vitest + RTL; `next.config` rewrites `/api` → `localhost:8000`; layout gốc.
- [ ] AC: `pnpm dev` chạy; component gọi `/api/v1/health` qua proxy hiển thị OK
- [ ] AC: `pnpm lint` + `pnpm test` + `pnpm build` pass

**Task 3: CI GitHub Actions** (S, deps: 1,2)
`.github/workflows/ci.yml`: job backend (uv sync, ruff, pytest+cov), job frontend (pnpm install, lint, test, build), trigger PR.
- [ ] AC: PR đầu tiên xanh cả 2 job

**✅ Checkpoint 0:** dev env trọn vẹn (compose + runserver + pnpm dev), CI hoạt động. Review trước khi sang phase 1.

### Phase 1 — Auth (story 1)

**Task 4: accounts models** (M, deps: 1)
Custom User (email, google_sub, display_name, avatar_url) + UserSettings (biên 0–100 / 0–1000, timezone ∈ zoneinfo); service tạo settings mặc định khi tạo user; migrations, admin, factories.
- [ ] AC: unit test — tạo user → settings mặc định (10 / 200 / Asia/Ho_Chi_Minh)
- [ ] AC: validate biên + timezone sai → lỗi
- Verify: `uv run pytest apps/accounts`

**Task 5: Auth API + error format nền** (M, deps: 4)
`POST /auth/google` (verify ID token bằng google-auth — mock trong test; get_or_create theo `sub`), access token trả body + refresh set httpOnly cookie (Secure, SameSite=Lax, rotation); `POST /auth/refresh`, `POST /auth/logout` (blacklist); `GET /me`. Custom exception handler `{"detail","code"}` dùng chung từ đây.
- [ ] AC: API test 4 endpoint happy path; token sai → 401 + code
- [ ] AC: refresh rotation hoạt động; logout xong refresh cũ bị từ chối
- Verify: `uv run pytest apps/accounts` + gọi thử bằng curl với token thật

**Task 6: Login UI + auth client** (M, deps: 2,5)
`/login` với nút Google (GIS); access token in-memory + silent refresh (interceptor, khôi phục phiên khi reload); route guard; logout; hiện tên/avatar từ `/me`.
- [ ] AC: login thật bằng Google → vào app; reload vẫn giữ phiên; logout về /login
- [ ] AC: test hook auth (mock fetch)

**✅ Checkpoint 1 = Success criterion #1** (đăng nhập Google → JWT → gọi API protected; logout hoạt động).

### Phase 2 — Deck, từ vựng, AI enrichment (stories 2,3,4)

**Task 7: vocab models + chuẩn hóa từ** (M, deps: 4)
Deck, WordCache (4 status), UserWord (đủ SRS fields + first/last_reviewed_at, unique constraints, cascade theo spec); util `normalize_word()` theo SPEC 6.5; migrations, factories.
- [ ] AC: unit test normalize (case / NFC / gộp space / regex reject)
- [ ] AC: constraint trùng tên deck, trùng từ trong deck

**Task 8: Deck API** (S, deps: 7)
CRUD `/decks` theo layered convention, pagination 50, filter theo user, 409 `deck_name_conflict`.
- [ ] AC: API test CRUD + 409 trùng tên + deck user khác → 404 + phân trang

**Task 9: Deck UI** (M, deps: 6,8)
`/decks`: list, tạo, sửa tên/mô tả, xóa (confirm), empty state.
- [ ] AC: CRUD chạy với backend dev; component test list + form

**Task 10: Enrichment providers** (M, deps: 1 — song song 8-9 được)
`WordEnrichment` dataclass, `AIProvider` Protocol, `GeminiProvider` (structured output + pydantic validate + giới hạn độ dài SPEC mục 9), `FakeProvider`, `get_provider()` theo env.
- [ ] AC: unit test factory chọn provider theo settings
- [ ] AC: parse response hợp lệ; reject sai schema / quá dài
- [ ] AC: FakeProvider dùng được cho dev không cần key

**Task 11: Enrich service + Celery task** (M, deps: 7,10)
Celery app config; service: get_or_create cache → hit copy / claim atomic (pending|failed→processing) → gọi provider **ngoài transaction** → completed copy / retry backoff max 3 → failed cả hai; task wrapper mỏng + `rate_limit="30/m"`.
- [ ] AC: test (mock provider): cache hit không gọi AI; 2 request cùng từ → 1 call
- [ ] AC: failed-as-miss; hết retry → cả WordCache lẫn UserWord = failed

**Task 12: Words API** (M, deps: 8,11)
POST thêm từ (normalize, 409 trùng, enqueue, throttle `enrichment` 50/ngày); GET list; GET/PATCH/DELETE `/words/{id}` (whitelist field, SRS read-only, đổi word_text → re-enrich + bỏ qua content fields kèm theo); retry-enrichment (chỉ failed, ngược lại 409, cùng throttle).
- [ ] AC: API test đủ nhánh trên; 429 sau 50 request/ngày
- [ ] AC: sửa nội dung UserWord không đụng WordCache

**Task 13: Words UI** (M, deps: 9,12)
Trang deck detail: bảng từ + trạng thái enrichment, form thêm, poll 2s khi pending (`useWord`), edit, retry, xóa.
- [ ] AC: thêm từ pending → completed hiện đủ 5 field; failed hiện nút retry
- [ ] AC: test form + poll hook (fake timers)

**✅ Checkpoint 2 = Success criteria #2, 3, 4, 8, 9** — cần GEMINI_API_KEY thật; #3 verify qua log: user thứ 2 thêm cùng từ → không có call Gemini lần 2. Review trước khi sang phase 3.

### Phase 3 — SRS (story 5)

**Task 14: SM-2 engine thuần** (S, deps: 1 — làm song song phase 2 được)
`apps/srs/engine.py`: CardState, Rating, `apply_review` đúng bảng SPEC 6.2 (ceil, Easy-new=4d, Again interval=0/due+10m, EF floor 1.3). Không import Django.
- [ ] AC: **coverage 100%** cho engine
- [ ] AC: test table-driven 4 nút × (new / reps=1 / reps>1) + edge Hard 1d→2d, Easy new→4d
- Verify: `uv run pytest --cov=apps/srs`

**Task 15: ReviewLog + queue + answer API** (M, deps: 7,14)
ReviewLog (SET_NULL); selector `build_review_queue` (quota distinct-cards + new theo first_reviewed_at, ngày theo timezone user, thứ tự SPEC 6.3); `GET /review/queue`; service `apply_review_answer` (engine → UserWord + first/last_reviewed_at → log); `POST /review/answer`.
- [ ] AC: test freeze-time: quota trừ đúng theo timezone; Again không ăn thêm quota
- [ ] AC: chấp nhận thẻ chưa due (luồng Again); new hết quota → không trả thẻ mới

**Task 16: Review UI** (M–L, deps: 13,15 — nếu phình, tách bước typing thành PR riêng)
`/review`: thẻ cũ typing (auto-check normalize) → flip đầy đủ + nút TTS (SpeechSynthesis en-US) → 4 nút; thẻ mới chỉ flip; Again re-queue local cuối phiên; màn tổng kết phiên.
- [ ] AC: component test luồng typing → flip → rating gọi API đúng
- [ ] AC: thẻ new chỉ flip; Again re-queue trong session
- Verify manual: ôn trọn 1 phiên với dữ liệu thật

**✅ Checkpoint 3 = Success criterion #5.**

### Phase 4 — Settings & Stats (stories 6,7)

**Task 17: Settings API + UI** (M, deps: 5,15)
`GET/PATCH /me/settings` (validate biên/timezone) + trang `/settings` (form limits + timezone select).
- [ ] AC: PATCH sai biên → 400 + code
- [ ] AC: đổi `new_words_per_day` → queue phản ánh (test selector) — **= criterion #6**

**Task 18: Stats API** (S–M, deps: 15)
Selectors overview (đếm 3 trạng thái, streak SPEC 6.4, ôn hôm nay) + daily (`days ≤ 365`) + 2 endpoint.
- [ ] AC: test streak (liền mạch / đứt / hôm nay chưa ôn / timezone)
- [ ] AC: đếm trạng thái đúng định nghĩa (first_reviewed_at + interval)

**Task 19: Stats UI** (S–M, deps: 18)
`/stats`: số liệu + streak + bar chart daily. ⚠️ Chart lib là dependency mới → hỏi trước khi cài (Boundaries); mặc định đề xuất vẽ SVG nhẹ không thêm dep.
- [ ] AC: hiển thị đúng mock data; test render

**✅ Checkpoint 4 = Success criterion #7.**

### Phase 5 — Production & launch

**Task 20: Docker prod + Nginx** (M, deps: phase 0–4)
Dockerfile backend (gunicorn) + frontend (standalone); `docker-compose.yml` (nginx, fe, be, worker, db, redis); nginx 1 domain: `/` → fe, `/api` → be, `client_max_body_size 1m`.
- [ ] AC: `docker compose up` local → app end-to-end qua nginx

**Task 21: Deploy workflow + backup** (M, deps: 20 + VPS/domain)
`deploy.yml`: main → build image (GHCR) → SSH VPS → pull/up → curl health; HTTPS certbot; cron `pg_dump` daily giữ 7 bản + tài liệu restore.
- [ ] AC: push main → VPS tự cập nhật, health 200 qua HTTPS

**Task 22: Launch checklist** (S, deps: 21)
Chạy đủ 11 success criteria trên VPS; backup offsite (chốt đích — SPEC Open Q #5) + test restore; rà OAuth verification (Open Q #4).
- [ ] AC: 11/11 criteria pass; restore từ backup OK

**✅ Checkpoint 5 = Success criteria #10, 11 → MVP hoàn thành.**

## Song song hóa

- Task 10 + 14 độc lập, làm xen kẽ phase 2 khi chờ review/CI.
- FE và BE trong cùng slice (8↔9, 12↔13, 15↔16) song song được vì API contract đã chốt trong SPEC.

## Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Solo dev mới học Django/DRF/Celery | Cao | task nhỏ S/M, layered convention rõ, test đi kèm từng task |
| Gemini structured output không ổn định schema | Vừa | pydantic validate + retry; FakeProvider cho dev/test |
| Silent refresh với access in-memory (App Router) dễ sai | Vừa | thiết kế hook auth kỹ ở task 6, test riêng luồng reload |
| Google OAuth config (origins, GIS) lắt nhắt | Vừa | làm sớm ngay phase 1, test localhost trước |
| VPS/domain chưa có → block phase 5 | Thấp | chốt trước khi xong phase 4 (Open Q #2) |
