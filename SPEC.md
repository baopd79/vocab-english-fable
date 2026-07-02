# Spec: Vocab English — Web app học từ vựng tiếng Anh cho người Việt

> **Trạng thái:** Draft v2 — đã review vòng 1, chốt các quyết định thiết kế
> **Ngày:** 2026-07-02
> **Nguồn:** Intent đã chốt qua interview (xem `docs/intent/vocab-app.md`)

## 1. Objective

Web app học từ vựng tiếng Anh tích hợp AI cho người Việt, launch công khai, tự host trên VPS. Solo dev (nền FastAPI, học thêm Django qua dự án này).

**User stories (MVP):**

1. Là người học, tôi đăng nhập bằng Google để bắt đầu ngay không cần tạo mật khẩu.
2. Là người học, tôi tạo các bộ từ vựng (deck) riêng để tổ chức từ theo chủ đề.
3. Là người học, tôi nhập 1 từ tiếng Anh và AI tự sinh: từ loại, phiên âm IPA, nghĩa tiếng Việt, câu ví dụ + bản dịch — tôi không phải tra cứu tay.
4. Là người học, tôi sửa được nội dung AI sinh ra nếu chưa ưng.
5. Là người học, tôi ôn tập hằng ngày theo SRS (SM-2): mỗi lượt gõ lại từ (recall) rồi lật thẻ xem đầy đủ (kèm phát âm), chấm 4 mức Again/Hard/Good/Easy như Anki.
6. Là người học, tôi tự chỉnh số từ mới/ngày và số thẻ ôn tối đa/ngày trong profile.
7. Là người học, tôi xem thống kê: số từ theo trạng thái, streak, số từ đã ôn theo ngày/tuần.

**Success = MVP chạy đủ 7 story trên VPS; kiến trúc mở rộng được (batch import, đổi AI provider, deck công khai) mà không refactor lớn.**

## 2. Tech Stack

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TanStack Query, Tailwind CSS | pnpm |
| Backend | Python 3.12, Django 5.x + Django REST Framework | uv quản lý deps |
| Auth | Google OAuth only → `djangorestframework-simplejwt` (JWT) | Frontend lấy Google ID token, Django verify + cấp JWT. Chi tiết token: mục 6.6 |
| Database | PostgreSQL 16 | |
| Queue | Celery + Redis broker | 1 worker, 1 queue mặc định — không Beat, không Flower |
| AI | Gemini (`gemini-2.5-flash`, đổi qua env), structured output JSON | Adapter pattern — đổi provider không sửa business logic |
| Deploy | Docker Compose trên VPS, Nginx + HTTPS (Let's Encrypt) | **1 domain duy nhất**: Nginx route `/` → Next.js, `/api` → Django (không CORS, cookie hoạt động). Chi tiết: mục 13 |
| CI/CD | GitHub Actions: PR → lint + test; main → build image → deploy VPS | |

## 3. Commands

```bash
# ===== Dev infra (Postgres + Redis) =====
docker compose -f docker-compose.dev.yml up -d

# ===== Backend (cd backend/) =====
uv sync                                    # cài deps
uv run python manage.py migrate            # migrate DB
uv run python manage.py runserver          # dev server :8000
uv run celery -A config worker -l info     # celery worker
uv run pytest                              # test
uv run pytest --cov=apps                   # test + coverage
uv run ruff check --fix . && uv run ruff format .   # lint + format

# ===== Frontend (cd frontend/) =====
pnpm install
pnpm dev                                   # dev server :3000
pnpm build
pnpm lint
pnpm test                                  # vitest

# ===== Production =====
docker compose up -d --build
```

## 4. Project Structure

```
vocab-english-fable/
├── SPEC.md
├── docs/
│   └── intent/vocab-app.md      # intent đã chốt
├── backend/
│   ├── config/                  # Django project: settings/, urls.py, celery.py
│   ├── apps/                    # mỗi app: models · serializers · views · urls
│   │   │                        #          · services · selectors · tasks · tests/ (mục 10)
│   │   ├── accounts/            # User model, UserSettings, Google auth endpoint
│   │   ├── vocab/               # Deck, WordCache, UserWord + CRUD API
│   │   ├── enrichment/          # AI provider adapter + Celery task
│   │   ├── srs/                 # SM-2 engine, review queue, ReviewLog
│   │   └── stats/               # API thống kê
│   ├── pyproject.toml
│   ├── manage.py
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # App Router pages: /login, /decks, /review, /stats, /settings
│   │   ├── components/          # UI components
│   │   └── lib/                 # API client, auth helpers, hooks
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml           # prod: nginx, frontend, backend, worker, db, redis
├── docker-compose.dev.yml       # dev: db + redis only
└── .github/workflows/           # ci.yml, deploy.yml
```

## 5. Data Model

> Nguyên tắc: schema chừa chỗ cho tính năng sau (batch import, deck công khai) nhưng không build trước thứ chưa cần.
>
> Convention: mọi model có `created_at`/`updated_at`. Mọi datetime lưu **UTC**; chỉ convert sang `UserSettings.timezone` khi tính "ngày" (review queue, streak, stats).

### accounts.User (custom user model)
| Field | Type | Ghi chú |
|---|---|---|
| email | unique | từ Google |
| google_sub | unique | Google subject ID |
| display_name, avatar_url | | từ Google profile |

### accounts.UserSettings (1–1 User)
| Field | Type | Default |
|---|---|---|
| new_words_per_day | int | 10 — biên 0–100, 0 = tạm dừng từ mới |
| max_reviews_per_day | int | 200 — biên 0–1000, 0 = tạm nghỉ ôn |
| timezone | str | `Asia/Ho_Chi_Minh` |

### vocab.Deck
| Field | Type | Ghi chú |
|---|---|---|
| owner | FK User | |
| name, description | | unique (owner, name) |
| visibility | enum: `private` | chừa `public` cho phase sau |

### vocab.WordCache — từ điển chung toàn hệ thống (global cache)
| Field | Type | Ghi chú |
|---|---|---|
| word | str, unique | đã chuẩn hóa theo mục 6.5 |
| status | enum: pending / processing / completed / failed | `processing` = task đang gọi AI (cơ chế claim, xem 6.1) |
| part_of_speech, ipa, meaning_vi, example_en, example_vi | text | |
| raw_response | JSONB | giữ full output AI cho migrate sau (đa nghĩa...) |
| provider, model | str | audit nguồn sinh |

### vocab.UserWord — bản sao riêng của user (sửa tự do) + trạng thái SM-2
| Field | Type | Ghi chú |
|---|---|---|
| user, deck | FK | unique (deck, word_text) |
| word_cache | FK nullable | link về cache gốc |
| word_text, part_of_speech, ipa, meaning_vi, example_en, example_vi | text | copy từ cache, user sửa được; đổi `word_text` → tự động re-enrich (mục 9) |
| enrichment_status | enum: pending / completed / failed | frontend poll field này |
| ease_factor | float | default 2.5, floor 1.3 |
| interval_days | int | default 0 |
| repetitions | int | default 0 |
| due_at | datetime | default now (thẻ mới) |
| first_reviewed_at | datetime, nullable | set 1 lần duy nhất ở review đầu tiên — null = thẻ new |
| last_reviewed_at | datetime, nullable | cập nhật mỗi lần review |

**Trạng thái từ (tính toán, không lưu):** `new` = `first_reviewed_at IS NULL` · `learning` = đã ôn và interval < 21 ngày · `mastered` = interval ≥ 21 ngày. (Không dùng `repetitions` để suy ra `new` vì Again reset `repetitions=0`.)

### srs.ReviewLog — phục vụ thống kê + streak
| Field | Type | Ghi chú |
|---|---|---|
| user | FK | |
| user_word | FK, nullable, `on_delete=SET_NULL` | giữ lịch sử khi xóa từ/deck |
| rating | enum: again / hard / good / easy | |
| interval_after, ease_after | snapshot sau review | |
| reviewed_at | datetime | |

**Quy tắc xóa:** xóa Deck → cascade UserWord, nhưng ReviewLog giữ nguyên (user_word=null) — streak và stats là lịch sử học, không thay đổi hồi tố.

## 6. Luồng nghiệp vụ chính

### 6.1 AI Enrichment (async)
```
POST /words {word} → chuẩn hóa (mục 6.5) → tạo UserWord(status=pending) → trả 201 ngay
  → enqueue Celery task:
      1. get_or_create WordCache theo từ đã chuẩn hóa
      2. Cache completed → copy vào UserWord, xong
      3. Claim: atomic UPDATE status (pending|failed → processing)
         — KHÔNG giữ DB transaction/lock trong lúc gọi AI
      4. Claim được → gọi Gemini (structured output) → WordCache=completed → copy vào UserWord
      5. Không claim được (task khác đang processing) → retry task với countdown, chờ kết quả
      6. Lỗi AI → retry (exponential backoff, max 3) → hết retry: WordCache + UserWord = failed
```
- Cache `failed` được coi như **miss**: request kế tiếp cho cùng từ sẽ enrich lại (bước 3 claim từ failed).
- Frontend poll `GET /words/{id}` tới khi `enrichment_status` đổi (completed/failed).
- Failed → user bấm retry: `POST /words/{id}/retry-enrichment` — reset cả UserWord lẫn WordCache (failed → pending) rồi enqueue lại.

**Adapter interface** (đổi provider = thêm class + đổi env `AI_PROVIDER`):
```python
@dataclass
class WordEnrichment:
    part_of_speech: str
    ipa: str
    meaning_vi: str
    example_en: str
    example_vi: str

class AIProvider(Protocol):
    def enrich_word(self, word: str) -> WordEnrichment: ...

# enrichment/providers/gemini.py → GeminiProvider
# enrichment/providers/factory.py → get_provider() đọc settings.AI_PROVIDER
```

### 6.2 SM-2 (simplified, 4 nút kiểu Anki)
Thẻ mới: `EF=2.5, reps=0, interval=0`. Khi trả lời:

| Rating | Công thức |
|---|---|
| **Again** | reps=0; EF −0.2 (floor 1.3); interval=0; thẻ quay lại phiên hiện tại (due = now + 10 phút) |
| **Hard** | EF −0.15 (floor 1.3); interval: reps=0 → 1d, ngược lại ceil(interval × 1.2); reps +1 |
| **Good** | interval: reps=0 → 1d, reps=1 → 6d, ngược lại ceil(interval × EF); reps +1 |
| **Easy** | EF +0.15; interval: reps=0 → **4d** (default Anki, phân biệt rõ với Good=1d), ngược lại ceil(interval(Good) × 1.3); reps +1 |

Interval làm tròn **lên** (ceil) thành ngày (trừ Again) — tránh thẻ kẹt interval (vd: Hard trên thẻ 1d → ceil(1.2) = 2d). Mỗi lần trả lời: cập nhật `last_reviewed_at`; set `first_reviewed_at` nếu đang null. Đây là nguồn chân lý cho unit test SM-2.

### 6.3 Review queue
`GET /review/queue` trả về 2 nhóm, thẻ đến hạn trước, thẻ mới sau:

- **Thẻ đến hạn:** `due_at <= now`, sắp xếp `due_at` cũ nhất trước. Giới hạn = `max_reviews_per_day` − số thẻ **distinct** đã ôn hôm nay (đếm theo ngày trong timezone user; bấm Again nhiều lần trên 1 thẻ chỉ tốn 1 suất quota).
- **Thẻ mới:** `first_reviewed_at IS NULL`, sắp xếp theo `created_at`. Giới hạn = `new_words_per_day` − số thẻ có `first_reviewed_at` trong hôm nay.

Thẻ Again quay lại phiên do **frontend giữ trong session** (re-queue vào cuối phiên đang ôn); backend chỉ trả thẻ đã tới `due_at` — user reload giữa chừng thì thẻ xuất hiện lại khi tới due (≤10 phút).

### 6.4 Streak
1 ngày được tính khi có ≥1 ReviewLog trong ngày đó (timezone user). Streak = số ngày liên tục tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa ôn).

### 6.5 Chuẩn hóa input từ vựng (khóa của WordCache)
`trim → lowercase → Unicode NFC → gộp khoảng trắng liên tiếp thành 1`. Hợp lệ: chữ cái `a-z`, khoảng trắng, gạch nối, apostrophe; tối đa 64 ký tự — regex `^[a-z][a-z' -]{0,63}$`. Cho phép cụm từ ("give up", "ice cream"). Input không hợp lệ → 400, không tạo UserWord.

### 6.6 Auth & phiên đăng nhập
- **Access token:** JWT, thời hạn **15 phút**, frontend giữ trong memory (không persist), gửi qua header `Authorization: Bearer`.
- **Refresh token:** thời hạn **7 ngày**, có rotation, lưu trong **httpOnly cookie** (Secure, SameSite=Lax) do Django set — JS không đọc được.
- **Logout:** `POST /auth/logout` → blacklist refresh token (`simplejwt token_blacklist`) + xóa cookie.
- Yêu cầu FE/BE cùng domain: prod qua Nginx (mục Deploy), dev qua Next.js `rewrites` proxy `/api` → `localhost:8000`.

### 6.7 Dạng ôn tập — luồng 1 lượt ôn
MVP có 2 dạng ôn + phát âm; **mỗi lượt ôn 1 từ đi qua tuần tự cả 2 dạng**, chấm điểm 1 lần:

1. **Typing (recall):** hiện `meaning_vi` + `part_of_speech` → user gõ từ EN. Auto-check: chuẩn hóa input (mục 6.5) rồi so sánh chính xác với `word_text` — sai là sai (không fuzzy match).
2. **Flip (nhận diện đầy đủ):** hiện `word_text` + IPA + nút phát âm 🔊 + nghĩa + câu ví dụ + bản dịch.
3. **Tự chấm 1 lần** Again/Hard/Good/Easy → cập nhật SM-2 (mục 6.2), ghi 1 ReviewLog. Typing sai → UI highlight gợi ý Again (user vẫn tự quyết).

**Ngoại lệ — thẻ new** (`first_reviewed_at IS NULL`): bỏ bước typing, chỉ flip (lần đầu là học, chưa có gì để nhớ lại).

**Phát âm:** Web Speech API (`SpeechSynthesis`, voice `en-US`) ngay trên browser — miễn phí, không cần backend/lưu audio.

Các dạng khác (flip VI→EN, trắc nghiệm, cloze, nghe-gõ) → roadmap.

## 7. API Endpoints (`/api/v1/`)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/auth/google` | body: Google ID token → verify → access token (body) + refresh token (httpOnly cookie) |
| POST | `/auth/refresh` | đọc refresh từ cookie → access token mới (rotation) |
| POST | `/auth/logout` | blacklist refresh token + xóa cookie |
| GET | `/me` | profile: email, display_name, avatar_url |
| GET/PATCH | `/me/settings` | giới hạn học, timezone |
| GET/POST | `/decks` · GET/PATCH/DELETE `/decks/{id}` | CRUD deck |
| GET/POST | `/decks/{id}/words` | list + thêm từ (trigger enrichment) |
| GET/PATCH/DELETE | `/words/{id}` | xem/sửa/xóa từ (đổi `word_text` → re-enrich, mục 9) |
| POST | `/words/{id}/retry-enrichment` | retry khi failed |
| GET | `/review/queue` | thẻ cần ôn hôm nay |
| POST | `/review/answer` | body: user_word_id + rating → cập nhật SM-2, ghi log |
| GET | `/stats/overview` | tổng từ theo trạng thái, streak, đã ôn hôm nay |
| GET | `/stats/daily?days=30` | số review theo ngày (cho chart), chặn `days ≤ 365` |
| GET | `/health` | không auth — cho deploy verify + uptime check |

Các endpoint list (decks, words) dùng DRF PageNumberPagination, page size **50**.

## 8. Rate Limiting

- **Per-user:** DRF throttling (Redis backend) — scope `enrichment`: 50 request/ngày/user, áp cho **cả** POST words **lẫn** POST retry-enrichment (không thì retry thành đường vòng qua limit). Các endpoint khác: 1000/giờ/user.
- **Ra Gemini:** Celery `rate_limit="30/m"` trên enrich task + retry backoff khi 429. Số cụ thể chỉnh theo quota thực tế của Gemini tier.

## 9. Validation — nguyên tắc "không bao giờ tin client"

| Input | Quy tắc |
|---|---|
| Google ID token | verify chữ ký + audience (client ID) + expiry bằng lib Google; `email`/`sub` lấy từ token đã verify, **không bao giờ** từ request body |
| Mọi ID trong URL | luôn filter queryset theo `request.user` (chống IDOR) — 404 nếu không thuộc user |
| `PATCH /me/settings` | `new_words_per_day` 0–100, `max_reviews_per_day` 0–1000 (0 = tạm dừng); `timezone` ∈ `zoneinfo.available_timezones()` |
| Deck | `name` 1–100 ký tự (strip), `description` ≤ 500; trùng (owner, name) → 409 |
| Thêm từ | chuẩn hóa + regex mục 6.5 (fail → 400); trùng từ trong deck → 409 |
| `PATCH /words/{id}` | whitelist field sửa được: `word_text` + 5 field nội dung (giới hạn: `part_of_speech` ≤ 50, `ipa` ≤ 100, `meaning_vi` ≤ 500, `example_*` ≤ 1000). Field SRS (`ease_factor`, `interval_days`, `repetitions`, `due_at`) và `enrichment_status`: **read-only tuyệt đối** |
| Đổi `word_text` | chuẩn hóa lại (6.5) → check trùng trong deck (409) → giữ nguyên SRS state, reset `enrichment_status=pending`, enqueue re-enrich (task get_or_create cache theo từ mới); field nội dung gửi kèm trong cùng request bị bỏ qua (enrichment sẽ ghi đè); **tính vào throttle scope `enrichment`** |
| `POST /review/answer` | `rating` ∈ enum; thẻ thuộc user; chấp nhận thẻ chưa tới `due_at` (cần cho luồng Again giữ ở frontend, mục 6.3) |
| `POST /words/{id}/retry-enrichment` | chỉ khi `enrichment_status=failed`, ngược lại 409 |
| Output Gemini | cũng là dữ liệu **không tin được** (đi vào cache dùng chung): validate bằng pydantic schema, cắt/từ chối field vượt độ dài trên, chỉ nhận plain text — frontend không bao giờ render HTML từ nội dung này |
| Request size | Nginx `client_max_body_size 1m` |

## 10. Code Style & Kiến trúc backend

### Layered architecture (bắt buộc)

```
Request → View (mỏng: auth, permission, gọi service/selector, trả response)
        → Serializer (chỉ validate input + shape output)
        → Service   (nghiệp vụ WRITE)  /  Selector (nghiệp vụ READ)
        → Model     (schema + constraint, không chứa flow nghiệp vụ)
Domain thuần: srs/engine.py — không import Django, test không cần DB
```

**Rules:**
- Mọi **WRITE** đi qua `services.py` — tên hàm động-từ-trước (`create_user_word`, `apply_review_answer`), mỗi hàm là 1 đơn vị transaction (`@transaction.atomic`).
- Mọi **READ có logic** (review queue, stats, aggregate) đi qua `selectors.py`; view chỉ được ORM trực tiếp cho get-by-id đơn giản (đã filter theo user).
- View **không bao giờ** gọi `.save()` hay chứa business logic; serializer không chứa nghiệp vụ.
- Celery task là wrapper mỏng gọi service — logic test được mà không cần Celery.
- Cross-app: **đọc** model chéo app được, **ghi** phải qua service của app sở hữu model.
- Mỗi app cùng bộ file: `models.py · serializers.py · views.py · urls.py · services.py · selectors.py · tasks.py · tests/`.
- Code + docstring tiếng Anh; tài liệu dự án tiếng Việt.
- ruff (lint + format), type hints đầy đủ (không chạy mypy trong CI).

**Error format:** custom DRF exception handler mỏng — mọi lỗi trả `{"detail": "...", "code": "..."}` (thêm `"errors": {field: [...]}` với validation error). Exception nghiệp vụ tự định nghĩa mang `default_code` (vd `deck_name_conflict`, `invalid_word`, `enrichment_not_failed`) để frontend xử lý theo `code`, không parse message.

```python
# apps/srs/engine.py — logic thuần, không dính Django ORM
def apply_review(state: CardState, rating: Rating) -> CardState:
    """Apply simplified SM-2. Returns new state, no mutation."""
    match rating:
        case Rating.AGAIN:
            return replace(state, repetitions=0,
                           ease_factor=max(1.3, state.ease_factor - 0.2),
                           due_in=timedelta(minutes=10))
        ...
```

**Frontend** — TypeScript strict, ESLint + Prettier, Server Components mặc định / `"use client"` chỉ khi cần tương tác, TanStack Query cho data fetching + polling:

```tsx
// lib/hooks/useWord.ts
export function useWord(id: number) {
  return useQuery({
    queryKey: ["word", id],
    queryFn: () => api.getWord(id),
    refetchInterval: (q) =>
      q.state.data?.enrichmentStatus === "pending" ? 2000 : false,
  });
}
```

Naming: Python `snake_case`, TS `camelCase`, component `PascalCase`, API JSON `snake_case` (theo DRF mặc định).

## 11. Testing Strategy

| Tầng | Tool | Phạm vi |
|---|---|---|
| Backend unit | pytest + pytest-django + factory-boy | **SM-2 engine: cover 100%** (thuật toán là lõi sản phẩm); services + selectors (queue, quota); enrichment task (mock provider); serializers |
| Backend API | pytest + DRF APIClient | happy path + auth + throttle cho mọi endpoint |
| Frontend | Vitest + React Testing Library | component ôn tập (typing → flip, 4 nút, auto-check), không chạy theo coverage |
| E2E | — | Skip ở MVP (thêm Playwright sau) |

Coverage backend tối thiểu **70%**, test chạy trong CI mọi PR. Gọi AI thật không bao giờ xảy ra trong test (mock `AIProvider`).

## 12. Boundaries

**Always:**
- Chạy `ruff` + `pytest` trước mỗi commit; CI xanh mới merge
- Mọi queryset filter theo `request.user`; field SRS và `enrichment_status` read-only với client (mục 9)
- Business logic chỉ nằm trong services / selectors / engine — không nằm trong views, serializers, models (mục 10)
- Mọi secret qua env var (`.env` — có `.env.example` trong repo)
- Gọi AI chỉ qua `AIProvider` interface, chỉ trong Celery task
- API versioned dưới `/api/v1/`
- Migration đi kèm PR thay đổi model

**Ask first (hỏi trước khi làm):**
- Thêm dependency mới
- Thay đổi schema sau khi đã có migration ban đầu
- Thay đổi công thức SM-2 hoặc mapping 4 nút
- Thay đổi auth flow, CI/CD config
- Thêm queue/worker/service mới vào Docker Compose

**Never:**
- Commit secret, API key, `.env`
- Gọi Gemini sync trong request/response cycle
- Xóa/skip test đang fail để cho CI xanh
- Sửa `WordCache` khi user edit từ (chỉ sửa bản copy `UserWord`)

## 13. Vận hành (Ops)

**Routing prod (1 domain):** Nginx: `/` → Next.js, `/api` → Django, HTTPS Let's Encrypt. Không CORS; httpOnly cookie hoạt động tự nhiên. Dev: Next.js `rewrites` proxy `/api` → `localhost:8000`.

**Backup PostgreSQL:**
- Ngay từ đầu: cron `pg_dump` hằng ngày, giữ 7 bản gần nhất trên VPS.
- **Trước khi launch công khai (bắt buộc):** đẩy backup ra ngoài VPS (object storage — Backblaze B2/S3 qua rclone) + test restore thành công 1 lần.

**Log & giám sát tối thiểu:** log qua `docker compose logs` (json-file, giới hạn size); deploy workflow gọi `GET /api/v1/health` để verify sau khi up; uptime check ngoài (vd UptimeRobot) trỏ vào `/api/v1/health`.

**Env vars** (nguồn cho `.env.example`):

| Biến | Ghi chú |
|---|---|
| `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `ALLOWED_HOSTS` | |
| `DATABASE_URL`, `REDIS_URL` | |
| `AI_PROVIDER` | default `gemini` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | model default `gemini-2.5-flash` |
| `GOOGLE_OAUTH_CLIENT_ID` | backend verify ID token; frontend dùng `NEXT_PUBLIC_GOOGLE_CLIENT_ID` cùng giá trị |

## 14. Success Criteria (điều kiện nghiệm thu MVP)

1. Đăng nhập Google → nhận JWT → gọi được API protected. Logout hoạt động.
2. Tạo deck, thêm từ "serendipity" → từ hiện ngay (pending) → ≤10s sau có đủ 5 field AI sinh (từ loại, IPA, nghĩa, ví dụ, dịch ví dụ).
3. User thứ 2 thêm cùng từ đó → không phát sinh call Gemini mới (hit cache), enrichment hoàn thành gần như tức thì.
4. Sửa tay nội dung 1 từ → lưu thành công, không ảnh hưởng WordCache.
5. Ôn tập: queue đúng thẻ đến hạn + đúng giới hạn ngày; lượt ôn thẻ cũ đi qua typing → flip (thẻ mới chỉ flip); 4 nút cập nhật interval/EF đúng công thức mục 6.2 (verify bằng unit test); Again đưa thẻ quay lại phiên.
6. Đổi `new_words_per_day` trong settings → queue ngày hôm sau phản ánh đúng.
7. Stats hiển thị đúng: đếm từ theo 3 trạng thái, streak, review theo ngày.
8. Enrichment fail (tắt mạng/key sai) → từ ở trạng thái failed + retry được.
9. User bị chặn khi vượt 50 enrichment/ngày (HTTP 429).
10. `docker compose up -d` trên VPS → app chạy đầy đủ qua HTTPS trên 1 domain (`/` FE, `/api` BE).
11. Backup hằng ngày đang chạy; đã đẩy offsite + test restore thành công 1 lần trước launch.

## 15. Roadmap sau MVP (không build bây giờ, chỉ để schema/kiến trúc chừa chỗ)

- Batch import: dán text / upload file / URL → extract từ → fan-out enrich tasks
- Deck công khai / chia sẻ (đã chừa field `visibility`)
- Đa nghĩa cho 1 từ (đã giữ `raw_response` JSONB)
- Dạng ôn mới: flip VI→EN, trắc nghiệm, cloze (điền từ vào câu ví dụ), nghe-gõ; nếu cần lịch SRS riêng cho từng dạng → migration tách bảng `srs.Card` (UserWord = note, mỗi dạng 1 card)
- Email/password auth, gamification, mobile, notification, monetization

## 16. Open Questions

1. Gemini tier nào (free hay paid)? → quyết định số `rate_limit` thực tế
2. Domain name + VPS specs đã có chưa?
3. Tên sản phẩm chính thức (đang dùng working title "Vocab English")
4. **Google OAuth verification:** consent screen chưa verify bị giới hạn ~100 user và cần Privacy Policy URL khi publish — cần trang privacy policy + submit verify trước/ngay sau launch công khai
5. Đích backup offsite: Backblaze B2, S3, hay dịch vụ khác? (cần chốt trước launch — xem mục 13)
