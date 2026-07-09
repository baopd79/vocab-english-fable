# Django cho người đến từ FastAPI — sổ tay theo dự án

> **Mục đích:** học Django/DRF qua chính code của Vocab English. Mỗi khái niệm đều trỏ về file thật trong repo để đọc đối chiếu.
> **Quy ước:** sau mỗi task, phần [Nhật ký theo task](#nhật-ký-theo-task) được bổ sung những gì mới + giải thích.

## 0. Khác biệt tư duy lớn nhất

FastAPI là **microframework**: bạn tự ghép ORM (SQLAlchemy), migration (Alembic), auth... Django là **batteries-included**: ORM, migration, auth, admin, session có sẵn trong một khối thống nhất — đổi lại bạn phải theo cấu trúc và quy ước của nó ("convention over configuration").

Bảng map nhanh từ thế giới FastAPI:

| Bên FastAPI | Bên Django/DRF | Trong repo này |
|---|---|---|
| `APIRouter` + endpoint function | View class + `urls.py` | `apps/accounts/views.py` + `urls.py` |
| Pydantic model (request/response) | DRF **Serializer** | `apps/accounts/serializers.py` |
| SQLAlchemy models + session | Django **ORM** (tích hợp sẵn) | `apps/accounts/models.py` |
| Alembic | `makemigrations` / `migrate` | `apps/accounts/migrations/` |
| pydantic-settings + `.env` | module `settings` | `config/settings/{base,dev,prod}.py` |
| `Depends()` (DI) | **không có DI** — thay bằng authentication/permission classes + middleware | `REST_FRAMEWORK` trong `base.py` |
| `TestClient` | `APIClient` (DRF) | `apps/accounts/tests/test_auth_api.py` |
| `/docs` tự động từ type hints | cài thêm **drf-spectacular** | `http://localhost:8000/api/docs/` |
| `uvicorn app:app` | `manage.py runserver` (dev) / gunicorn + `config/wsgi.py` (prod) | |
| — (không có) | **Django admin** miễn phí | `http://localhost:8000/admin/` |

Điểm gây ngỡ ngàng nhất: **Django ORM không tự validate khi `.save()`** (khác hẳn Pydantic — xem mục 3), và **không có dependency injection** — mọi thứ cấu hình qua class attributes và settings toàn cục.

## 1. Cấu trúc project: `config/` vs `apps/`

```
backend/
├── manage.py            # CLI entry — chỉ là wrapper set DJANGO_SETTINGS_MODULE rồi gọi django
├── config/              # "project" — cấu hình, không chứa business logic
│   ├── settings/        # base.py (chung) ← dev.py / prod.py override
│   ├── urls.py          # bảng route gốc, include() từng app
│   ├── wsgi.py          # entry cho gunicorn (như app = FastAPI())
│   └── env.py           # loader .env tự viết (thay python-dotenv)
└── apps/                # các "app" — đơn vị module hóa của Django
    ├── accounts/        # mỗi app: models, views, serializers, urls, services, tests...
    └── common/
```

**"App" là khái niệm cốt lõi:** một app = một Python package chứa models + views + migrations của một mảng nghiệp vụ. Django chỉ "nhìn thấy" app nào được khai trong `INSTALLED_APPS` (`config/settings/base.py`) — model không nằm trong app đã khai sẽ không có migration, không hiện trong admin. `INSTALLED_APPS` cũng chứa app của Django (`django.contrib.*`) và của package ngoài (`rest_framework`, `drf_spectacular`) — tất cả bình đẳng như nhau.

**Settings ba tầng:** `base.py` chứa mọi thứ chung, `dev.py`/`prod.py` import `*` rồi override vài dòng. Biến môi trường `DJANGO_SETTINGS_MODULE` quyết định dùng file nào (pytest set nó trong `pyproject.toml` → luôn chạy với `dev`). So với FastAPI: giống một class Settings của pydantic-settings, nhưng là module Python thuần — đọc env qua `os.getenv` chứ không tự parse.

**Middleware** (`MIDDLEWARE` trong base.py): pipeline bọc quanh mọi request như middleware của Starlette, thứ tự từ ngoài vào trong. Mình chưa đụng đến — bộ mặc định lo security headers, session, CSRF.

**URL routing:** không có decorator `@app.get(...)`. Mỗi app có `urls.py` liệt kê `path("auth/google", GoogleLoginView.as_view())`, rồi `config/urls.py` gom lại bằng `include()` — tương đương `app.include_router(router, prefix="/api/v1")`.

## 2. `manage.py` — lệnh hằng ngày

```bash
uv run python manage.py runserver          # dev server :8000, tự reload khi sửa code
uv run python manage.py makemigrations     # sinh file migration từ thay đổi models
uv run python manage.py migrate            # áp migration vào DB
uv run python manage.py shell              # REPL đã load Django (ORM dùng được ngay)
uv run python manage.py createsuperuser    # tạo tài khoản vào /admin
uv run python manage.py spectacular --file /dev/null   # kiểm tra schema OpenAPI có lỗi không
```

`manage.py` thực chất chỉ set `DJANGO_SETTINGS_MODULE` mặc định rồi ủy quyền cho Django — mọi app đều có thể thêm lệnh riêng vào đây (Celery, spectacular... đã làm thế).

## 3. Models & ORM

Model = class kế thừa `models.Model`, mỗi attribute là một cột ([apps/accounts/models.py](../backend/apps/accounts/models.py)):

```python
class UserSettings(TimeStampedModel):
    user = models.OneToOneField("accounts.User", on_delete=models.CASCADE, related_name="settings")
    new_words_per_day = models.IntegerField(default=10, validators=[MinValueValidator(0), MaxValueValidator(100)])
```

Những điều đáng chú ý so với SQLAlchemy:

- **Không có session.** Mỗi model có manager `objects`: `User.objects.get(...)`, `.filter(...)`, `.get_or_create(...)`, `.create(...)`. Mỗi `.save()` là một câu UPDATE/INSERT ngay. Transaction gom nhóm bằng `@transaction.atomic` (mình đặt trên mọi hàm service).
- **`related_name`** tạo quan hệ ngược: `user.settings` truy cập UserSettings của user (vì là OneToOne). Với FK thường sẽ là `user.userword_set` hoặc tên bạn đặt.
- **⚠️ Validators KHÔNG chạy khi `.save()`.** `validators=[...]` chỉ chạy khi gọi `instance.full_clean()` hoặc khi đi qua Serializer/ModelForm. Đây là khác biệt lớn nhất với Pydantic (validate mọi lúc). Vì thế mình phòng thủ 3 tầng: serializer validate input → `full_clean()` trong test → **DB CheckConstraint** trong `Meta.constraints` chặn cả code bypass validation.
- **`Meta`** — class con khai báo metadata: constraints, unique_together, verbose_name, `abstract = True`...
- **Abstract model:** `TimeStampedModel` ([apps/common/models.py](../backend/apps/common/models.py)) có `abstract = True` trong Meta → không tạo bảng riêng, chỉ "trộn" 2 cột created_at/updated_at vào model con. Mọi model của dự án kế thừa nó.
- **Custom User:** Django có sẵn hệ user/auth. Muốn thêm field (google_sub...) thì kế thừa `AbstractUser` và khai `AUTH_USER_MODEL = "accounts.User"`. **Bẫy nổi tiếng:** phải làm điều này **trước migration đầu tiên** — đổi sau khi DB đã có bảng auth là cực kỳ đau đớn. Vì vậy Task 1 đã khai stub User rỗng dù chưa cần field nào.

## 4. Migrations — giống Alembic nhưng "auto" hơn

- `makemigrations` **diff models với state ghi trong các file migration cũ** (không nhìn DB như Alembic autogenerate!) rồi sinh file Python vào `apps/<app>/migrations/`.
- `migrate` áp các file chưa chạy vào DB (Django ghi sổ trong bảng `django_migrations`).
- Migration là code — commit vào git, review được, sửa tay được (đã từng: xem nhật ký Task 4).
- `makemigrations --check --dry-run` trong CI/verify: bảo đảm models và migrations không lệch nhau.
- Package ngoài cũng mang migration theo: cài `token_blacklist` xong phải `migrate` để nó tạo bảng.

## 5. Django Admin — công cụ miễn phí FastAPI không có

Đăng ký model trong `admin.py` ([apps/accounts/admin.py](../backend/apps/accounts/admin.py)) là có ngay CRUD UI tại `/admin` — xem/sửa user, settings mà không cần viết dòng UI nào. Với solo dev, đây là công cụ vận hành (support, debug data) rất đáng giá. Cần `createsuperuser` để đăng nhập.

## 6. DRF: vòng đời request → response

FastAPI: request → Depends chain → function → return Pydantic → JSON.
DRF: request → middleware → View → (authentication → permission → parse body) → code của bạn → Response → renderer.

```python
class GoogleLoginView(APIView):
    authentication_classes: list = []      # thay cho Depends(get_current_user)
    permission_classes: list = []          # [] = public; mặc định toàn cục là IsAuthenticated

    def post(self, request: Request) -> Response:          # tên method = HTTP verb
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)           # 400 tự động nếu sai
        user = authenticate_google_user(credential=serializer.validated_data["credential"])
        ...
        return Response({"access": ...})
```

- **Serializer = Pydantic model 2 chiều.** Một class vừa validate input (`is_valid` → `validated_data`) vừa shape output (`UserSerializer(user).data`). `ModelSerializer` sinh field tự động từ model (như `model_config from_attributes` nhưng mạnh hơn).
- **Cấu hình toàn cục** trong `REST_FRAMEWORK` (base.py): authentication mặc định (JWT), permission mặc định (`IsAuthenticated` — mọi endpoint tự động cần đăng nhập, view nào public phải tự tuyên bố), exception handler, renderer. View override được từng cái bằng class attribute — đây là cách DRF thay thế DI.
- **Exception handler** ([apps/common/exceptions.py](../backend/apps/common/exceptions.py)): mọi lỗi → `{"detail", "code"}`. Exception nghiệp vụ tự định nghĩa kế thừa `APIException` + `default_code` — view/service chỉ việc `raise`, không cần try/except ở view.
- **⚠️ Bẫy 401 vs 403:** DRF hạ `AuthenticationFailed` từ 401 xuống 403 nếu view không có authentication class (không có header `WWW-Authenticate` để trả). Gặp thật ở Task 5 — giải pháp trong [apps/accounts/exceptions.py](../backend/apps/accounts/exceptions.py).
- **Renderer:** JSON mặc định; dev bật thêm `BrowsableAPIRenderer` (`dev.py`) → mở endpoint trong browser ra form HTML test tay.
- **Docs:** view viết tay phải gắn `@extend_schema(request=..., responses=...)` thì drf-spectacular mới đưa vào schema — không tự suy từ type hints như FastAPI.

## 7. Auth stack: simplejwt + Google

- `djangorestframework-simplejwt`: cấp cặp access/refresh (`RefreshToken.for_user(user)`), verify qua `JWTAuthentication` (đặt làm default). Cấu hình trong `SIMPLE_JWT` (base.py): lifetime 15 phút / 7 ngày, `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`.
- App con `token_blacklist` lưu refresh token vào DB (bảng OutstandingToken/BlacklistedToken) để thu hồi được — logout = `RefreshToken(raw).blacklist()`.
- Refresh token nằm trong **httpOnly cookie** do Django set (`response.set_cookie(...)` trong views.py) — scope `path=/api/v1/auth` để browser chỉ gửi cho endpoint auth.
- Google login: FE lấy ID token qua GIS popup → BE verify chữ ký + audience bằng `google-auth` → claims (`sub`, `email`) chỉ lấy từ token đã verify, không bao giờ từ request body.

## 8. Kiến trúc layered — quy ước của dự án, KHÔNG phải của Django

Django "chính thống" thường nhét logic vào models (fat models) hoặc views. Dự án này chọn convention khác (SPEC §10), gần với cách bạn tổ chức FastAPI service layer:

```
View (mỏng) → Serializer (chỉ validate/shape) → services.py (mọi WRITE, @transaction.atomic)
                                              → selectors.py (READ có logic)
                                              → Model (schema + constraint, không flow nghiệp vụ)
```

Lý do: logic test được không cần HTTP, transaction rõ ràng, view không bao giờ gọi `.save()`. Celery task cũng chỉ là wrapper mỏng gọi service. Đây là điểm cần kỷ luật tự giác vì Django không ép.

## 9. Testing

- **pytest-django** nối pytest với Django: settings từ `pyproject.toml`, DB test tự tạo/hủy.
- **`@pytest.mark.django_db`** (hoặc `pytestmark` cả file): cho phép test chạm DB — mỗi test bọc trong transaction rồi **rollback** → test độc lập nhau mà vẫn nhanh.
- **`APIClient`** = TestClient: `client.post("/api/v1/auth/google", {...})`, `client.credentials(HTTP_AUTHORIZATION="Bearer ...")`, `client.cookies[...]`.
- **factory-boy** ([apps/accounts/factories.py](../backend/apps/accounts/factories.py)): khai báo cách sinh object mẫu (`UserFactory()` → user với sequence email duy nhất) thay vì fixture JSON.
- **Mock ở biên ngoài cùng:** test auth mock đúng 1 chỗ `id_token.verify_oauth2_token` (network call sang Google) — mọi thứ còn lại chạy thật từ HTTP xuống DB.

## 10. Bẫy đã gặp thật (đọc để khỏi dẫm lại)

1. **AUTH_USER_MODEL phải có trước migration đầu** → Task 1 khai stub `User(AbstractUser)` rỗng dù chưa cần.
2. **Thêm `auto_now_add` vào bảng đã tồn tại** → makemigrations hỏi default cho hàng cũ qua prompt tương tác; trả lời sai sinh ra `default=1` → phải sửa file migration tay thành `django.utils.timezone.now` (Task 4).
3. **DRF hạ 401 → 403** trên view không có authenticator → exception tự định nghĩa với `status_code = 401` tường minh (Task 5).
4. **`ZoneInfo("asia/ho_chi_minh")` chạy ngon trên macOS** (filesystem không phân biệt hoa thường) **nhưng sẽ crash trên Linux** → validate timezone bằng membership trong `available_timezones()` (Task 4).
5. **Migration files phải loại khỏi ruff** (`extend-exclude` trong pyproject) — code sinh tự động không theo style của mình.
6. **`google-auth` cần extra `requests`** (`uv add 'google-auth[requests]'`) mới có transport để verify token.

## 11. Sync hay async? (câu hỏi kinh điển từ FastAPI)

Backend này **sync 100%** (WSGI + gunicorn, view sync, ORM sync) — có chủ đích:

- Async chỉ thắng khi request phải "ôm" I/O chậm trong lúc chờ (hàng nghìn kết nối đồng thời, streaming, websocket). Endpoint của mình toàn CRUD vài mili-giây vào Postgres cục bộ — gunicorn vài worker là thừa cho quy mô MVP.
- **I/O chậm duy nhất là gọi Gemini (1–5s), và kiến trúc đã đẩy nó ra khỏi request cycle** (SPEC §6.1): POST thêm từ chỉ enqueue Celery task rồi trả về ngay, FE poll trạng thái. FastAPI giải bài này bằng `await` trong endpoint; Django giải bằng background worker — cùng mục đích, khác công cụ.
- Đi async với Django+DRF là bơi ngược hệ sinh thái: DRF chưa hỗ trợ async view chính thức, ORM async còn nửa vời. Được ít, trả giá friction mọi lớp.
- Nghĩ lại chỉ khi cần: stream AI trực tiếp (SSE), websocket, concurrency rất cao — lúc đó tách phần đó ra ASGI/microservice riêng.

**Khi nào cần mix async vào project này?** Chỉ khi có tính năng buộc giữ kết nối mở trong request path (SSE, WebSocket). Các cơn đau khác có thuốc rẻ hơn: query chậm → index/cache; workers bận → tăng gunicorn workers; chờ API ngoài → Celery (đang làm); fan-out nhiều call AI trong batch import → tăng Celery concurrency hoặc pool gevent (chỉ đổi config worker). Nếu đến lúc thật sự cần, lộ trình từ nhẹ đến nặng: (1) đổi pool Celery, (2) Django cho phép trộn sync + async view — chuyển deploy sang ASGI và viết riêng endpoint stream bằng async view thuần (DRF chưa hỗ trợ async), 95% app giữ nguyên, (3) tách microservice realtime sau Nginx (route `/stream` → service mới, `/api` vẫn về Django). Cả 3 đều là bổ sung cục bộ — nền sync + Celery vẫn là xương sống.

**Lưu ý về `await db.execute(...)` bên FastAPI:** await không làm query nhanh hơn — query 5ms vẫn mất 5ms; nó chỉ cho event loop phục vụ request khác trong lúc chờ. Async chỉ thắng khi *(số request đồng thời × thời gian chờ)* đủ lớn: query 5ms thì sync 4 workers đã dư sức ~800 req/s (nghẽn ở Postgres trước), nhưng gọi API ngoài 2s trong request thì sync 4 workers chỉ chịu được 2 req/s — đó là chỗ async thắng, và cũng là bài Django giải bằng Celery. Ba bẫy phía FastAPI: driver sync trong `async def` chặn cả event loop; `def` thường trong FastAPI chạy threadpool (nhiều project dùng sync SQLAlchemy vẫn ổn); async dễ vỡ connection pool DB vì không tự giới hạn concurrency như sync worker.

## Nhật ký theo task

> Sau mỗi task, mục này được bổ sung: task làm gì, khái niệm Django nào mới xuất hiện, đọc file nào để hiểu.

### Task 1–3 — Skeleton + CI (Phase 0)
- Sinh project bằng `django-admin startproject`, tách settings 3 tầng, viết env loader tối giản (`config/env.py`) thay python-dotenv.
- Khái niệm mới: project vs app, `INSTALLED_APPS`, `manage.py`, custom User stub (bẫy #1), APIView đầu tiên (HealthView) + renderer JSON-only.
- DB/Redis chạy Docker (`docker-compose.dev.yml`); pytest-django + coverage ≥70% từ ngày đầu.

### Task 4 — accounts models
- `User(TimeStampedModel, AbstractUser)` thêm field Google; `UserSettings` OneToOne với validators + CheckConstraint 2 tầng; service `create_user_settings` idempotent (get_or_create).
- Khái niệm mới: abstract model, `Meta.constraints`, `full_clean()` vs `.save()` (mục 3), migration tay (bẫy #2), admin đăng ký model (mục 5), factory-boy.
- Đọc: `apps/accounts/models.py`, `apps/common/models.py`, `apps/accounts/tests/test_models.py`.

### Task 5 — Auth API
- 4 endpoint auth + exception handler toàn dự án `{"detail","code"}`.
- Khái niệm mới: simplejwt + token_blacklist (mục 7), `response.set_cookie` httpOnly, exception handler + `APIException` tự định nghĩa (bẫy #3), mock biên ngoài trong test (mục 9), `@transaction.atomic` trên service.
- Đọc: `apps/accounts/views.py`, `services.py`, `apps/common/exceptions.py`, `tests/test_auth_api.py`.

### Task 6 — Login UI (frontend, ít Django)
- Phía Django không đổi; điểm liên quan: cookie refresh hoạt động xuyên proxy dev vì FE/BE same-origin (Next rewrites `/api` → :8000).
- Bài học phía client: access token giữ in-memory, silent refresh + retry 1 lần khi 401 (`frontend/src/lib/api.ts`).

### Task 7 — vocab models + chuẩn hóa từ
- 3 model mới: `Deck`, `WordCache` (cache AI toàn hệ thống), `UserWord` (bản sao riêng + SRS state) — [apps/vocab/models.py](../backend/apps/vocab/models.py); util thuần `normalize_word()` — [apps/vocab/normalization.py](../backend/apps/vocab/normalization.py).
- Khái niệm Django mới:
  - **`TextChoices`** — enum cho field choices (`WordCache.Status.PENDING`): vừa là hằng số Python vừa sinh validate + label; so với FastAPI là thay cho `Enum` của Pydantic nhưng gắn thẳng vào cột DB.
  - **`JSONField`** (`raw_response`) — cột JSONB của Postgres, đọc/ghi dict Python trực tiếp.
  - **`on_delete` từng FK là quyết định nghiệp vụ:** Deck→UserWord dùng `CASCADE` (xóa deck mất từ), WordCache→UserWord dùng `SET_NULL` (xóa cache, bản sao của user còn nguyên). ReviewLog sau này cũng `SET_NULL` để giữ lịch sử học.
  - **`UniqueConstraint` nhiều cột** trong `Meta.constraints` (`(owner, name)`, `(deck, word_text)`) thay vì `unique=True` một cột; test bằng `pytest.raises(IntegrityError)`.
  - **`default=timezone.now`** (truyền callable, không gọi `()`) — như `default_factory` của Pydantic.
  - **factory-boy nâng cao:** `SubFactory` lồng nhau + `SelfAttribute("..user")` để deck của UserWordFactory tự thuộc đúng user.
- Vì sao có `normalization.py` riêng: logic domain thuần (không import Django) → test không cần DB, tái dùng ở serializer (Task 12) lẫn typing check khi ôn tập.
- Đọc: `apps/vocab/models.py`, `normalization.py`, `tests/test_models.py` (cascade + constraint), `tests/test_normalization.py` (parametrize).

### Task 8 — Deck API (lát cắt CRUD đầu tiên qua đủ các lớp)
- Endpoint `/decks` (GET list + POST) và `/decks/{id}` (GET/PATCH/DELETE) — đây là lần đầu chạy trọn kiến trúc layered: View → Serializer → Service/Selector → Model.
- Khái niệm Django/DRF mới:
  - **Phân vai rõ:** `selectors.py` (READ có logic: `list_decks` filter theo owner + order) vs `services.py` (WRITE: `create_deck`/`update_deck`/`delete_deck`). View chỉ gọi, không `.save()`.
  - **⚠️ Bắt `IntegrityError` phải nằm NGOÀI `atomic()`** — dùng dạng context manager `with transaction.atomic(): ...` bọc trong `try/except`, KHÔNG dùng decorator `@transaction.atomic`. Lý do: sau khi IntegrityError bắn, transaction đã hỏng, mọi ORM call tiếp theo trong block đều lỗi; Django yêu cầu catch ở ngoài rồi mới xử lý. Đây là cách biến unique-constraint clash thành 409 sạch sẽ ([services.py](../backend/apps/vocab/services.py)).
  - **Chống IDOR bằng `get_object_or_404(Deck, pk=pk, owner=request.user)`** — id của user khác trả **404** (không phải 403) vì không được để lộ "có tồn tại nhưng không thuộc bạn" (SPEC §9). Http404 được exception handler format thành `{"detail","code":"not_found"}`.
  - **Pagination:** `PageNumberPagination` (page_size 50) trong [apps/common/pagination.py](../backend/apps/common/pagination.py); với APIView phải phân trang **thủ công** (`paginator.paginate_queryset(...)` → `get_paginated_response(...)`) vì auto-pagination chỉ áp cho generic view. Response bọc `{count, next, previous, results}`.
  - **`ModelSerializer` + `read_only_fields`** (`visibility`, timestamps) — field read-only bị loại khỏi `validated_data` nên client gửi `visibility=public` bị bỏ qua an toàn; `validate_<field>` (vd `validate_name`) để trim + chặn rỗng.
  - **Test:** `APIClient.force_authenticate(user=...)` bỏ qua tầng JWT để test thẳng logic view; `create_batch(51)` của factory-boy để test phân trang.
- Đọc: `apps/vocab/{views,services,selectors,serializers}.py`, `tests/test_deck_api.py`.

### Task 9 — Deck UI (frontend, ít Django)
- Phía Django không đổi. Điểm liên quan hợp đồng API: UI dựa vào đúng shape phân trang `{count, next, previous, results}` và code lỗi `deck_name_conflict` / `validation_error` mà Task 8 định nghĩa — đã smoke test bằng token mint tại chỗ (`RefreshToken.for_user` trong `manage.py`-style script) để xác nhận backend trả đúng.
- Bài học phía client (tham khảo, không phải Django): TanStack Query `useQuery`/`useMutation` + `invalidateQueries(["decks"])` để list tự refetch sau create/update/delete; form tách khỏi mutation (dumb component nhận `onSubmit`); map `ApiError.code` → thông báo tiếng Việt. Bẫy test: không bật `globals` thì RTL không tự cleanup DOM giữa test → phải gọi `cleanup()` trong `vitest.setup.ts`.
- Đọc: `frontend/src/lib/decks.ts`, `components/deck-form.tsx`, `app/decks/page.tsx`.

### Task 10 — Enrichment providers (adapter pattern cho AI)
- App mới `apps/enrichment` hiện chỉ có package `providers/` — một app Django **không bắt buộc phải có models.py**; vẫn khai báo trong `INSTALLED_APPS` để Celery autodiscover `tasks.py` ở Task 11.
- Kiến trúc adapter (SPEC §6.1): business logic chỉ biết `AIProvider` + `WordEnrichment` ([providers/base.py](../backend/apps/enrichment/providers/base.py)); đổi vendor AI = thêm 1 class + đổi env `AI_PROVIDER`, không sửa service.
- Khái niệm mới:
  - **`typing.Protocol`** — structural typing ("duck typing có kiểm tra"): `FakeProvider` và `GeminiProvider` không kế thừa gì cả, chỉ cần có đúng method `enrich_word(word) -> WordEnrichment` là thỏa interface. Khác ABC (phải kế thừa tường minh); với FastAPI bạn thường đạt cùng mục đích qua `Depends` + interface ngầm.
  - **Pydantic sống chung với Django:** DRF serializer validate **HTTP input từ client**, còn pydantic validate **output của AI** ([providers/schema.py](../backend/apps/enrichment/providers/schema.py)) — cũng là dữ liệu không tin được (SPEC §9) nhưng không đi qua request cycle. Quyết định đã chốt: field vượt giới hạn độ dài → **reject** (raise `EnrichmentError` → Celery retry ở Task 11), không cắt bớt, vì dữ liệu vào `WordCache` dùng chung phải sạch. Schema pydantic này đồng thời được gửi cho Gemini làm `response_schema` (structured output) — nhưng ranh giới tin cậy là validate phía mình, không phải lời hứa của API.
  - **`settings` là mặt cấu hình:** `settings.AI_PROVIDER` / `GEMINI_API_KEY` / `GEMINI_MODEL` đọc từ env trong `base.py`; test đổi cấu hình bằng **`@override_settings(AI_PROVIDER="fake")`** — tương đương override dependency trong FastAPI test.
  - **`ImproperlyConfigured`** — exception chuẩn Django cho lỗi cấu hình (thiếu key, provider lạ): fail sớm và ồn ào lúc khởi tạo thay vì lỗi khó hiểu lúc gọi.
  - **Mock tại biên ngoài cùng:** test patch `genai.Client` (constructor) rồi gắn `generate_content.return_value` — không mock method của chính mình; giống pattern đã dùng với `id_token.verify_oauth2_token` ở Task 5.
- Đã smoke test 1 call Gemini thật (key trong `.env`): `enrich_word("serendipity")` trả đủ 5 field hợp lệ.
- Đọc: `apps/enrichment/providers/{base,schema,fake,gemini,factory}.py`, `tests/test_providers.py`.

### Task 11 — Enrich service + Celery task
- Luồng SPEC §6.1 nằm trọn trong [apps/enrichment/services.py](../backend/apps/enrichment/services.py) (orchestrator `enrich_user_word` + các hàm ghi nhỏ) và wrapper mỏng [tasks.py](../backend/apps/enrichment/tasks.py); Celery app ở [config/celery.py](../backend/config/celery.py) (`config_from_object(namespace="CELERY")` + `autodiscover_tasks()` — quét `tasks.py` của mọi app trong `INSTALLED_APPS`).
- Khái niệm mới:
  - **Claim atomic bằng UPDATE có điều kiện:** `filter(pk=..., status__in=[pending, failed]).update(status=processing)` — 2 worker đua nhau thì WHERE chỉ khớp cho đúng 1; không dùng `select_for_update` (không giữ lock trong lúc gọi AI). Trả về số dòng bị ảnh hưởng → `bool` = có claim được không.
  - **Orchestrator KHÔNG bọc transaction** — ngoại lệ có chủ đích của quy tắc "mỗi service = 1 `@transaction.atomic`": nếu bọc, transaction sẽ ôm luôn call Gemini 2-30s. Chỉ các hàm ghi con là atomic.
  - **`queryset.update()` vs `instance.save()`:** update() ghi thẳng SQL — không chạy `full_clean`, không `auto_now`, nhưng **an toàn với race** (từ bị xóa giữa chừng → 0 rows, không crash). Phải tự set `updated_at=timezone.now()`.
  - **Retry của Celery:** `bind=True` để có `self`; `self.retry(countdown=...)` ném exception `Retry` cho worker re-queue; `self.request.retries` đếm lần thử; backoff mũ `5 * 2**retries` (5s/10s/20s); hết 3 lần → cả WordCache lẫn UserWord = failed. `rate_limit="30/m"` áp ở mức worker cho call ra Gemini.
  - **Test task không cần broker:** `task.apply(args=[...])` chạy eager ngay tại chỗ (kể cả vòng retry, bỏ qua countdown) — không Redis, không worker. FastAPI tương đương là `BackgroundTasks` nhưng Celery tách hẳn process nên phải test kiểu này.
  - **`config/settings/test.py` mới:** pytest chạy settings riêng — cache LocMem + tắt throttle (CI không có Redis; PK user lặp lại giữa các test rollback nên counter throttle sẽ "rò" giữa test nếu bật thật).
- Đọc: `apps/enrichment/{services,tasks}.py`, `config/celery.py`, `tests/test_enrichment_flow.py` (đủ 4 AC: hit không gọi AI, 2 request → 1 call, failed-as-miss, hết retry → failed cả hai).

### Task 12 — Words API
- 3 endpoint mới: `GET/POST /decks/{id}/words`, `GET/PATCH/DELETE /words/{id}`, `POST /words/{id}/retry-enrichment` — vẫn theo template layered của Task 8, thêm 3 exception nghiệp vụ (`invalid_word` 400, `word_conflict` 409, `enrichment_not_failed` 409).
- Khái niệm mới:
  - **DRF throttling (SPEC §8):** `UserRateThrottle` mặc định 1000/giờ + `ScopedRateThrottle` scope `enrichment` 50/ngày dùng chung cho POST words, retry, và PATCH đổi `word_text` (chống đi vòng). Counter lưu trong **Redis cache** (share giữa các gunicorn worker). Override `get_throttles()` để throttle theo method/nội dung request (chỉ POST, chỉ PATCH có `word_text`).
  - **⚠️ Bẫy `THROTTLE_RATES`:** DRF gắn `api_settings.DEFAULT_THROTTLE_RATES` vào **class attribute** lúc import — `override_settings(REST_FRAMEWORK=...)` không đổi được rate trong test; phải patch thẳng `SimpleRateThrottle.THROTTLE_RATES` (fixture trong [test_word_api.py](../backend/apps/vocab/tests/test_word_api.py)).
  - **`transaction.on_commit(...)`:** enqueue Celery task chỉ sau khi transaction commit — nếu `.delay()` ngay trong atomic, worker có thể chạy trước khi row tồn tại. Trong test, transaction không bao giờ commit (pytest rollback) → dùng fixture `django_capture_on_commit_callbacks(execute=True)` của pytest-django để callback chạy.
  - **Whitelist bằng Serializer thường (không phải ModelSerializer):** `UserWordUpdateSerializer` chỉ khai báo 6 field sửa được; client gửi `ease_factor`/`enrichment_status` bị lặng lẽ bỏ qua — read-only tuyệt đối không cần code phòng thủ thêm.
  - **Semantics PATCH đổi `word_text` (SPEC §9):** chuẩn hóa lại → check trùng 409 → giữ SRS, reset pending, cắt link `word_cache`, enqueue re-enrich; content field gửi kèm bị bỏ qua. Đây là logic service, serializer không biết gì.
  - **`config/settings/test.py`** tắt throttle toàn cục vì counter throttle sống trong cache còn PK user thì lặp lại giữa các test (DB rollback nhưng cache thì không) → nếu bật thật sẽ dính 429 ngẫu nhiên giữa các test.
- Đọc: `apps/vocab/{services,views,serializers,exceptions}.py` (phần words), `tests/test_word_api.py` (21 test đủ nhánh).

### Task 13 — Words UI (frontend, ít Django)
- Trang `/decks/[id]`: bảng từ + trạng thái enrichment, form thêm từ, sửa 6 field, xóa (confirm), retry khi failed. Route động App Router: thư mục `[id]`, client component đọc param bằng `useParams()`.
- Điểm đáng nhớ phía client:
  - **Poll theo SPEC §11:** `useWord(id)` với `refetchInterval: (q) => q.state.data?.enrichment_status === "pending" ? 2000 : false` — mỗi row pending tự poll 2s, hoàn thành thì tự dừng, không cần state ngoài.
  - **Row sở hữu query riêng** (`useWord(word.id, word)` với `initialData` từ list) — list không phải refetch liên tục, chỉ row pending poll.
  - **Test hook poll bằng fake timers:** `vi.useFakeTimers()` + `advanceTimersByTimeAsync(2000)`; bẫy: React Query commit data sau một tick phụ → cần advance thêm ~100ms trước khi assert.
  - Form thêm từ nhận `onSubmit` trả Promise — resolve thì tự xóa input, reject thì giữ nguyên cho user sửa; error message map từ `code` (`invalid_word`, `word_conflict`, `throttled`).
- Đọc: `frontend/src/lib/words.ts`, `components/add-word-form.tsx`, `app/decks/[id]/page.tsx`, `lib/words.test.tsx`.

### Task 14 — SM-2 engine thuần (lõi thuật toán)
- [apps/srs/engine.py](../backend/apps/srs/engine.py): `Rating` (enum), `CardState`/`ReviewResult` (dataclass frozen), `apply_review(state, rating)` cài đúng bảng SPEC §6.2. **Không import Django** — đây là điểm khác biệt kiến trúc quan trọng nhất của task này.
- Vì sao tách riêng khỏi Django (giống triết lý FastAPI: business logic không phụ thuộc framework):
  - Test **không cần DB, không cần `django_db`** — chạy trong 0.14s, không cần Postgres/Redis. Chính vì thuần nên bắt được coverage **100%** dễ dàng (AC bắt buộc, vì đây là "nguồn chân lý" của lịch ôn mọi user).
  - App `srs` **chưa đăng ký vào `INSTALLED_APPS`** ở task này — nó mới chỉ là package Python chứa logic thuần; Task 15 thêm model `ReviewLog` mới đăng ký. Django không bắt buộc mọi thư mục dưới `apps/` phải là app đã đăng ký.
- Khái niệm/quyết định mới:
  - **Engine không biết đồng hồ:** trả `due_offset: timedelta` (stdlib, không phải Django) thay vì tính `due_at` tuyệt đối — tầng service (Task 15) mới cộng vào thời điểm review. Giữ hàm thuần, dễ test.
  - **`match rating:` (Python 3.13)** dispatch 4 nhánh Rating — sạch hơn if/elif.
  - **Quyết định làm tròn Easy (đã hỏi & chốt):** `ceil(interval × EF × 1.3)` — ceil **một lần** trên số thực (triết lý Anki), không nhân đôi sai số làm tròn. Gói trong helper `_good_interval()` trả giá trị Good **trước khi ceil** để cả Good lẫn Easy dùng chung.
  - **Test golden-table:** `@pytest.mark.parametrize` với bảng `(state, rating) → kỳ vọng`, id rõ ràng cho từng ca; `pytest.approx` cho `ease_factor` vì float (2.5−0.2 ≠ đúng 2.3 trong IEEE754). Có test bất biến: input `CardState` frozen không bị mutate.
- Đọc: `apps/srs/engine.py`, `tests/test_engine.py` (21 test: 4 nút × 3 trạng thái + edge + floor + single-ceil).

### Task 15 — ReviewLog + review queue + answer API
- Đây là lúc app `srs` **chính thức thành Django app**: thêm `models.py` (`ReviewLog`), đăng ký `apps.srs` vào `INSTALLED_APPS`, `makemigrations srs` sinh `0001_initial`. Engine thuần Task 14 vẫn không import Django; các file mới (selectors/services/views) mới là tầng Django bọc ngoài.
- `ReviewLog`: `user_word` dùng **`SET_NULL`** (xóa từ/deck → log giữ lại, `user_word=null`) vì streak/stats là lịch sử học không đổi hồi tố; `user` dùng CASCADE. Có `reviewed_at` riêng (không dựa `created_at`) để khớp đúng `now` đã dùng tính `due_at`, và index `(user, reviewed_at)` cho truy vấn quota/streak.
- Khái niệm/quyết định mới:
  - **Timezone-aware "ngày" (SPEC §6.3):** mọi thứ lưu UTC, nhưng "hôm nay" tính theo `UserSettings.timezone`. Helper `user_day_start()` đổi `now` sang giờ địa phương → lấy nửa đêm → đổi lại UTC làm mốc lọc. Test chứng minh review lúc 23:00 địa phương (hôm qua) vs 00:30 (hôm nay) trừ quota khác nhau.
  - **Dependency injection `now` thay cho freezegun:** `build_review_queue(*, user, now=None)` và `apply_review_answer(..., now=None)` nhận `now` để test tất định, không thêm dependency. Đây là mẹo giữ hàm thuần-hóa một phần.
  - **Quota "distinct cards":** đếm `ReviewLog.values("user_word").distinct().count()` — bấm Again nhiều lần trên 1 thẻ chỉ tốn 1 suất; test phân biệt count-rows (sai) vs count-distinct (đúng).
  - **Thẻ mới tách khỏi nhóm due:** due filter thêm `first_reviewed_at__isnull=False` để thẻ mới (due_at mặc định = now) không lọt cả 2 nhóm.
  - **`apply_review_answer` nối engine → persistence:** đọc SRS field vào `CardState`, gọi `apply_review`, ghi lại + `due_at = now + result.due_offset`, set `first_reviewed_at` **đúng 1 lần** (Again không reset), tạo `ReviewLog`. Cả service là 1 `@transaction.atomic`.
  - **Endpoint answer chấp nhận thẻ chưa due (SPEC §9):** không filter `due_at`, chỉ filter theo `user` (404 nếu của người khác) — cần cho luồng Again mà frontend giữ trong session.
  - Response queue `{"due": [...], "new": [...]}` shape bằng `ReviewQueueSerializer` (Serializer thường lồng `UserWordSerializer(many=True)`) để drf-spectacular vẫn sinh schema.
- Đọc: `apps/srs/{models,selectors,services,views,serializers}.py`, `tests/test_queue_selector.py` (quota + timezone), `tests/test_review_api.py`.

### Task 16 — Review UI (frontend, ít Django)
- Trang `/review`: fetch queue 1 lần → phiên ôn giữ **local** (Again re-queue vào cuối, không refetch) → màn tổng kết. Thành phần: [review-card.tsx](../frontend/src/components/review-card.tsx) (typing → flip → 4 nút), [app/review/page.tsx](../frontend/src/app/review/page.tsx) (session runner), util thuần [normalize.ts](../frontend/src/lib/normalize.ts) + [tts.ts](../frontend/src/lib/tts.ts).
- ⚠️ **Bài học Django quan trọng nhất của task:** smoke test live báo `ProgrammingError: relation "srs_reviewlog" does not exist`. Nguyên nhân: Task 15 chạy `makemigrations` (sinh **file** migration) nhưng chưa `migrate` (áp lên **DB dev**). Test suite luôn xanh vì pytest tự dựng DB test từ migration mỗi lần chạy; còn Postgres dev là DB thật, tồn tại lâu dài, phải `uv run python manage.py migrate` thủ công sau khi thêm model. `makemigrations` ≠ `migrate` — cái đầu mô tả thay đổi, cái sau thực thi lên DB đang chạy.
- Phía client (tham khảo, không phải Django):
  - **Session là state cục bộ, không phải server state:** queue fetch 1 lần (`staleTime: Infinity`), phiên ôn là `useState` mảng thẻ; Again = `setSession(s => [...s, card])` + `POST /review/answer`. Server chỉ biết từng lượt chấm (ghi ReviewLog); thứ tự re-queue là việc của frontend (đúng SPEC §6.3).
  - **Auto-check gõ:** `normalizeWord()` bên TS soi gương §6.5 backend (trim→lower→NFC→collapse) rồi so khớp **chính xác** với `word_text` (đã chuẩn hóa sẵn) — không fuzzy.
  - **TTS miễn phí:** `SpeechSynthesis` ngay trên browser, có guard cho môi trường không có API (SSR/jsdom) nên test không crash.
  - **Thẻ new bỏ bước typing:** `first_reviewed_at === null` → vào thẳng flip; phím tắt 1–4 chấm điểm.
- Đọc: `frontend/src/lib/{review,normalize,tts}.ts`, `components/review-card.tsx`, `app/review/page.tsx`, các test tương ứng.

### Task 17 — Settings API + UI (criterion #6)
- `GET/PATCH /me/settings` thêm vào app `accounts` (không model mới → **không migration**): `UserSettingsSerializer`, service `update_user_settings`, `MeSettingsView`. Trang `/settings` bên frontend.
- Khái niệm/quyết định mới:
  - **GET tự tạo settings nếu thiếu:** view gọi `create_user_settings` (idempotent get_or_create) trước khi trả — không bao giờ 500 vì thiếu row, kể cả user cũ.
  - **Validate 2 tầng rõ ràng:** serializer khai `IntegerField(min_value, max_value)` tường minh (thay vì phó mặc DRF suy từ model validator) + `validate_timezone` tái dùng `validate_timezone_name`; service thêm `full_clean()` (defense-in-depth: serializer → full_clean → DB constraint, SPEC §9). PATCH sai biên → 400 `validation_error` + `errors[field]`.
  - **Serializer validate nhưng KHÔNG lưu:** view validate bằng serializer rồi gọi `update_user_settings(**serializer.validated_data)` — đúng luật "serializer không ghi, service ghi".
  - **Bẫy test — cached reverse relation:** `user.settings` cache trên instance sau lần truy cập đầu; sau khi PATCH đổi DB, gọi lại `build_review_queue(user=user)` vẫn thấy giá trị cũ trong cùng 1 test. Fix: load lại `User.objects.get(pk=...)`. Production không gặp vì mỗi request load user mới. Đây chính là cách verify **criterion #6** (đổi `new_words_per_day` → queue phản ánh).
  - **UX phía client (tham khảo):** input `type=number` có `max`/`min` → trình duyệt (và jsdom) **chặn submit** giá trị ngoài biên trước cả khi gọi API; timezone là `<select>` danh sách rút gọn nên luôn hợp lệ. Vì vậy test "server reject" phải gửi giá trị hợp lệ rồi cho stub trả 400 để chạm nhánh hiển thị lỗi.
- Đọc: `apps/accounts/{serializers,services,views}.py` (phần settings), `tests/test_settings_api.py`; `frontend/src/lib/settings.ts`, `app/settings/page.tsx`.

### Task 18 — Stats API
- App mới `apps/stats` **không có model** (thống kê tính từ `ReviewLog` + `UserWord`) — giống `srs` giai đoạn Task 14, nhưng lần này có đăng ký `INSTALLED_APPS` cho gọn (app không model thì không sinh migration). 2 endpoint `GET /stats/overview` + `GET /stats/daily?days=`.
- Khái niệm/quyết định mới:
  - **3 trạng thái từ là partition (SPEC §5):** `new` = `first_reviewed_at IS NULL`; `learning` = đã ôn và `interval < 21`; `mastered` = `interval ≥ 21`. Không dùng `repetitions` (Again reset về 0). Vì thẻ mới luôn interval 0, ba nhóm không chồng lấn.
  - **Streak (§6.4) tính Python-side theo local date:** gom tập các *ngày địa phương* có ≥1 ReviewLog rồi đếm chuỗi liên tục kết thúc hôm nay (hoặc hôm qua nếu hôm nay chưa ôn). Chọn cách gom set-ngày trong Python thay vì SQL `date_trunc` theo timezone để né SQL phụ thuộc DB và test tất định. Quyết định đã chốt: daily + `reviewed_today` đếm **thẻ distinct** (Again không thổi số), khớp story 7 "số từ đã ôn".
  - **Zero-fill cho chart:** `daily_reviews` trả đủ mọi ngày trong khoảng (kể cả count 0) để trục x liên tục — không chỉ ngày có dữ liệu.
  - **Validate query param bằng serializer:** `DailyQuerySerializer(days IntegerField(min_value=1, max_value=365, default=30))` chạy trên `request.query_params` → `days` sai/ngoài biên → 400 `validation_error`. Sạch hơn parse tay.
  - **DI `now` + `tz` cho selector:** mọi hàm cần "hôm nay" nhận `now`/`tz` để test freeze-time không cần freezegun; test chứng minh review 23:00 vs 00:30 giờ địa phương rơi vào ngày khác nhau.
  - **Serializer đọc được dataclass:** trả `StatsOverview`/`DailyPoint` (dataclass) cho `Serializer(instance).data` — DRF đọc field qua getattr nên dataclass hay dict đều được.
- Đọc: `apps/stats/{selectors,serializers,views}.py`, `tests/test_stats_selectors.py` (streak + timezone + distinct), `tests/test_stats_api.py`.

### Task 19 — Stats UI (frontend, ít Django)
- Trang `/stats`: 3 thẻ trạng thái + streak + "đã ôn hôm nay" + bar chart 30 ngày. Phía Django không đổi — chỉ tiêu thụ 2 endpoint của Task 18.
- Quyết định (đã hỏi, đúng boundary "thêm dependency mới"): **vẽ bar chart bằng SVG thuần, không thêm chart lib** — component [daily-bar-chart.tsx](../frontend/src/components/daily-bar-chart.tsx) ~40 dòng, `<rect>` scale theo max, `<title>` cho tooltip. Bundle nhẹ, 0 dependency mới.
- Bài học phía client (tham khảo):
  - **`getByTitle` của RTL chỉ match `svg > title` (con trực tiếp của svg)** — `<title>` lồng trong `<rect>` không tìm được dù browser vẫn hiện tooltip khi hover. Test phải query `container.querySelectorAll("title")` rồi so text content.
  - Chống chia cho 0: `max = Math.max(1, ...counts)` để ngày toàn 0 không vỡ layout.
- Đọc: `frontend/src/lib/stats.ts`, `components/daily-bar-chart.tsx`, `app/stats/page.tsx`, các test.

### Bổ sung — API docs cho dev
- drf-spectacular (Swagger UI tại `/api/docs/`, chỉ khi DEBUG) + BrowsableAPIRenderer trong `dev.py`.
- Khái niệm mới: renderer per-environment, `@extend_schema`, lệnh `manage.py spectacular` kiểm tra schema.

### UI v2 — Redesign "Duolingo-green glassmorphism" (kèm 1 thay đổi backend nhỏ)
- Redesign toàn bộ frontend theo file design `Vocab English v2.dc.html` (claude.ai/design): nền gradient xanh lá, card kính (glassmorphism), nút 3D kiểu Duolingo, font **Bricolage Grotesque** + Be Vietnam Pro, header điều hướng chung + trang chủ dạng dashboard. Logic `src/lib/` giữ nguyên.
- Phần Django mới (đáng đọc):
  - **Annotate `Count` có điều kiện:** `list_decks` giờ trả kèm `word_count=Count("words")` và `mastered_count=Count("words", filter=Q(words__interval_days__gte=21))` — đếm bằng **1 câu SQL cho cả trang list** (GROUP BY), tránh N+1 query khi mỗi deck tự `.count()`. `Q(...)` trong `filter=` của aggregate là cách Django viết `COUNT(...) FILTER (WHERE ...)` của Postgres.
  - **SerializerMethodField có fallback:** `DeckSerializer.get_word_count` đọc thuộc tính annotate nếu có (`getattr(deck, "word_count", None)`), không có thì tự query — vì các path một-object (POST create, GET/PATCH detail qua `get_object_or_404`) không đi qua selector nên không có annotation. Đổi 2 query/deck ở detail lấy sự đơn giản; list (nhiều deck) vẫn 0 query thừa.
  - **Cross-app import một chiều:** `vocab` import hằng `MASTERED_INTERVAL_DAYS` từ `apps.stats.selectors` (stats chỉ import *models* của vocab nên không tạo vòng import). Ngưỡng "mastered ≥ 21 ngày" chỉ định nghĩa một chỗ.
- Đọc: `apps/vocab/selectors.py` (annotate), `apps/vocab/serializers.py` (fallback), `tests/test_deck_api.py::TestListDecks::test_word_and_mastered_counts`; frontend: `src/app/globals.css` (token 2 theme + `.glass`), `components/app-header.tsx`, `app/page.tsx` (dashboard).

### Task 20 — Docker prod + Nginx 1 domain
- Đóng gói toàn bộ stack thành image production: `backend/Dockerfile` (gunicorn), `frontend/Dockerfile` (Next standalone), `nginx/default.conf` (1 domain: `/api` + `/admin` + `/static` → Django, còn lại → Next), `docker-compose.prod.yml` (6 service: nginx, frontend, backend, worker, db, redis — chỉ nginx mở port). Verify local: cả app chạy end-to-end qua `http://localhost`.
- Khái niệm Django mới:
  - **gunicorn thay runserver:** `runserver` là server dev đơn luồng, không chịu tải thật; prod chạy `gunicorn config.wsgi:application --workers 3` — 3 process Python độc lập cùng nhận request. Đây là lý do throttle counter phải nằm ở Redis (base.py đã làm từ trước): mỗi worker là một process riêng, không chia sẻ bộ nhớ.
  - **collectstatic + whitenoise (chỉ để phục vụ /admin):** Django không tự phục vụ static khi `DEBUG=False`. `collectstatic` gom file tĩnh về `STATIC_ROOT` **ngay lúc build image**; middleware whitenoise cho gunicorn tự phục vụ chúng — khỏi cần Nginx đụng vào static. `CompressedManifestStaticFilesStorage` đổi tên file theo hash nội dung (cache bust) + nén sẵn gzip.
  - **Chạy sau reverse proxy:** Django chỉ thấy kết nối http từ Nginx. `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` bảo Django tin header Nginx gửi để `request.is_secure()` đúng — quyết định cờ `Secure` của refresh cookie. Đi kèm là Nginx phải set `proxy_set_header X-Forwarded-Proto $scheme`.
  - **`manage.py check --deploy`:** checklist hardening tự động của Django. Còn 2 warning chủ đích (HSTS, SSL redirect) — cả hai thuộc Task 21 vì cần HTTPS thật trước.
- Khái niệm Docker/hạ tầng mới (không phải Django nhưng là lõi của task):
  - **Multi-stage build:** stage builder cài deps (uv sync / pnpm install), stage cuối chỉ copy kết quả — image không mang build tool. Copy `pyproject.toml + uv.lock` trước, code sau → sửa code không phải resolve lại deps (layer cache).
  - **Service-name networking + healthcheck:** trong compose network, container gọi nhau bằng tên service (`db:5432`, `redis:6379`, `http://backend:8000`) — vì thế `.env.prod` dùng `@db` thay `@localhost`. `depends_on: condition: service_healthy` để nginx chỉ lên khi backend/frontend thật sự sẵn sàng.
  - **Bài học trả giá tại chỗ — project name trùng:** compose đặt tên project theo thư mục, nên `docker-compose.prod.yml` chạy lần đầu đã **đè lên db/redis của docker-compose.dev.yml** (cùng thư mục). Fix: khai báo `name: vocab-english-prod` trong file prod. Triệu chứng nhận ra: log hiện `vocab-english-fable-db-1` thay vì `vocab-english-prod-db-1`.
  - **Nginx cache IP container:** `proxy_pass http://backend:8000` tĩnh sẽ ghim IP lúc nginx khởi động → deploy container mới là 502. Dùng `resolver 127.0.0.11` + biến `set $backend ...` để nginx re-resolve theo DNS của Docker.
  - **NEXT_PUBLIC_* là build-time:** giá trị bị nướng vào bundle JS lúc `pnpm build`, nên client id phải truyền qua `build.args` chứ không phải env runtime.
- Đọc: `backend/Dockerfile`, `frontend/Dockerfile`, `nginx/default.conf`, `docker-compose.prod.yml` (comment đầu file = trình tự boot + migrate one-shot), `config/settings/prod.py`, `.env.prod.example`; nền tảng lý thuyết: `docs/deploy-guide.md` mục 1.4–1.7.
