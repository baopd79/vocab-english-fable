# Deploy Guide — Fundamentals & Roadmap

> Tài liệu nền tảng cho Phase 5 (task 20–22 trong `tasks/plan.md`) và lộ trình nâng trình độ vận hành về sau.
> Bối cảnh: solo dev, chưa từng deploy VPS. App: Django + DRF, Next.js, Celery, Postgres, Redis — self-host 1 VPS, 1 domain (SPEC §13).
> Cách dùng: đọc **Phần 1** để hiểu khái niệm (mỗi mục ghi rõ "áp vào project này thế nào"), rồi làm theo **Phần 2** từng bước. **Phần 3** là lộ trình sau launch.

---

## Phần 1 — Fundamentals: 10 khối kiến thức

### Bức tranh tổng thể

Khi hoàn thành Phase 5, request của user đi qua chuỗi này:

```
Browser ── HTTPS ──> DNS (domain → IP VPS)
                        │
                   VPS (Ubuntu)
                        │
                   Nginx :443  (reverse proxy + TLS)
                    ├── /      → frontend  (Next.js standalone, :3000)
                    └── /api   → backend   (gunicorn Django, :8000)
                                     ├── db     (Postgres 16, volume)
                                     ├── redis  (broker + throttle cache)
                                     └── worker (Celery — enrichment Gemini)
```

Tất cả 6 service chạy bằng Docker Compose trên cùng 1 máy. So với dev hiện tại: `pnpm dev` + `runserver` + `docker-compose.dev.yml` được thay bằng **1 file `docker-compose.yml` prod** chạy hết.

### 1.1 VPS & Linux cơ bản

VPS = máy ảo Linux thuê theo tháng, bạn có toàn quyền root qua SSH. Với stack này, **2GB RAM / 1–2 vCPU / 25GB disk** là đủ (Postgres + Redis + gunicorn + Celery + Next.js + Nginx ~ 1–1.5GB RAM).

Việc phải làm **một lần duy nhất** khi nhận VPS mới (thứ tự quan trọng):

1. **SSH bằng key, không bằng password.** Tạo key trên máy local (`ssh-keygen -t ed25519`), copy lên VPS (`ssh-copy-id`). Sau đó tắt password login trong `/etc/ssh/sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no`.
2. **Tạo user thường có sudo** (vd `deploy`), không làm việc bằng root: `adduser deploy && usermod -aG sudo,docker deploy`.
3. **Firewall UFW** — chỉ mở đúng 3 cổng: `ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable`. Postgres/Redis **không bao giờ** mở ra ngoài — chúng chỉ nói chuyện trong Docker network nội bộ.
4. **Tự động vá bảo mật:** `apt install unattended-upgrades` (Ubuntu hỏi 1 câu là xong).
5. **fail2ban** (chặn brute-force SSH): `apt install fail2ban` — mặc định là đủ.

> ⚠️ Lỗi người mới hay gặp nhất: trong compose prod mà viết `ports: "5432:5432"` cho db (copy từ `docker-compose.dev.yml`) → Postgres lộ ra internet, bot scan thấy trong vài giờ. **Prod chỉ expose cổng của Nginx (80/443).** Các service khác dùng `expose` hoặc không khai ports gì cả.

### 1.2 DNS & domain

Domain là tên → IP. Cần đúng 1 bản ghi:

| Type | Name | Value |
|---|---|---|
| A | `@` (hoặc subdomain, vd `vocab`) | IP của VPS |

Đợi propagate (vài phút → vài giờ), verify bằng `dig +short yourdomain.com` phải ra IP VPS. **Phải xong bước này trước khi làm HTTPS** — Let's Encrypt verify qua domain.

Áp vào project: SPEC chốt **1 domain duy nhất** cho cả FE lẫn BE — đây là lý do không cần CORS và refresh cookie (`SameSite=Lax`, `path=/api/v1/auth`) hoạt động tự nhiên. Đừng tách `api.domain.com` — sẽ vỡ thiết kế auth.

### 1.3 HTTPS / TLS (Let's Encrypt)

HTTPS bắt buộc vì: (a) Google OAuth yêu cầu origin HTTPS ngoài localhost, (b) refresh cookie set `Secure`, (c) không ai gõ mật khẩu/token qua HTTP. Let's Encrypt cấp cert **miễn phí, hạn 90 ngày, tự gia hạn** bằng certbot.

Cách đơn giản nhất cho setup này: cài certbot **trên host** (không trong Docker) với plugin nginx, hoặc dùng webroot challenge. Certbot sửa config nginx thêm cert + redirect 80→443, và tự tạo systemd timer gia hạn. Verify gia hạn hoạt động: `certbot renew --dry-run`.

Sau khi có HTTPS, set trong `backend/.env` prod: `DJANGO_DEBUG=false` và bật các cờ secure (xem 1.6).

### 1.4 Reverse proxy — Nginx

Nginx đứng trước tất cả, nhận mọi request ở cổng 443 rồi chia theo path:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    client_max_body_size 1m;                # SPEC §9

    location /api {                          # → Django
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    location / {                             # → Next.js
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
    }
}
```

Vì sao cần nó thay vì expose thẳng app:
- **1 domain 2 app** — đúng thiết kế same-origin của project (thay thế `next.config.ts` rewrites của dev).
- **TLS termination** — chỉ Nginx lo cert, app phía sau chạy HTTP thường.
- **Chặn rác sớm** — giới hạn body size, có thể thêm rate-limit tầng ngoài sau này.

`X-Forwarded-Proto` quan trọng: Django phía sau proxy cần `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")` trong `config/settings/prod.py` để biết request gốc là HTTPS (nếu không, cookie `Secure` và redirect sẽ sai).

### 1.5 App server production

**Backend:** `runserver` là dev server — single-thread, không bảo mật, Django tự cảnh báo không dùng cho prod. Prod dùng **gunicorn** (WSGI server):

```
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

Rule of thumb workers = `2 × CPU + 1`; VPS 1 vCPU → 3 workers là hợp lý. Celery worker vẫn là lệnh y như dev (`celery -A config worker`), chỉ khác chạy trong container.

**Frontend:** `pnpm dev` → thay bằng `next build` với `output: "standalone"` trong `next.config.ts`. Build ra `server.js` tự chạy bằng `node`, image cuối chỉ cần copy `.next/standalone` — không cần `node_modules` đầy đủ, image nhỏ hơn ~10 lần.

**Static files của Django:** API thuần không có mấy, nhưng admin cần CSS → chạy `collectstatic` trong Dockerfile và cho **whitenoise** serve (đơn giản nhất, khỏi cấu hình nginx cho static).

### 1.6 Config & secrets production

Nguyên tắc: **cùng một image, khác env** — image build một lần, hành vi đổi qua biến môi trường. Trên VPS, secrets nằm trong file `.env` cạnh `docker-compose.yml`, **tạo tay một lần, chmod 600, không bao giờ nằm trong git/image**.

Khác biệt bắt buộc giữa dev và prod (nằm trong `config/settings/prod.py`):

| Setting | Dev | Prod | Nếu quên |
|---|---|---|---|
| `DEBUG` | true | **false** | Lộ stack trace + settings cho attacker |
| `ALLOWED_HOSTS` | `*` | `["yourdomain.com"]` | Host header attack |
| `SECRET_KEY` | placeholder | random 50+ ký tự, sinh mới | Giả mạo session/token |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | false | true | Cookie đi qua HTTP |
| `SECURE_PROXY_SSL_HEADER` | — | `("HTTP_X_FORWARDED_PROTO", "https")` | Django tưởng request là HTTP |
| Postgres password | `vocab` | random dài | — |

Công cụ kiểm: `uv run python manage.py check --deploy` — chạy với settings prod, nó liệt kê đúng những cờ còn thiếu. Ngoài ra Google OAuth Client cần **thêm origin `https://yourdomain.com`** vào Authorized JavaScript origins (console.cloud.google.com) — quên bước này là nút Google login chết ngay trên prod dù mọi thứ khác đúng.

### 1.7 Docker production

Khái niệm cốt lõi, đối chiếu với những gì repo đã có:

- **Image vs container:** image = bản đóng gói bất biến (code + deps), container = tiến trình chạy từ image. Dev hiện tại chỉ dùng image có sẵn (`postgres:16-alpine`); Phase 5 sẽ **tự build** 2 image (backend, frontend) bằng Dockerfile.
- **Multi-stage build:** stage 1 cài deps + build, stage 2 chỉ copy kết quả → image nhỏ, không chứa toolchain. Quan trọng nhất với frontend (copy `.next/standalone`).
- **Registry (GHCR):** nơi chứa image build sẵn. CI build trên GitHub Actions → push `ghcr.io/baopd79/vocab-*` → VPS chỉ `docker compose pull`. **VPS không bao giờ build** — build ăn RAM/CPU và cần source code trên server.
- **Volume:** dữ liệu sống lâu hơn container. Duy nhất Postgres cần volume (như `vocab_dev_pgdata` ở dev). Xóa container thoải mái, mất volume = mất database.
- **Network:** các service trong cùng compose gọi nhau bằng **tên service** (`DATABASE_URL=postgresql://...@db:5432/vocab`, nginx `proxy_pass http://backend:8000`) — không phải localhost.
- **Healthcheck + depends_on:** dev compose đã có healthcheck Postgres; prod thêm `depends_on: {db: {condition: service_healthy}}` để backend không khởi động trước khi db sẵn sàng.
- **`restart: unless-stopped`** cho mọi service — VPS reboot hay app crash thì tự dậy lại.
- **Migrations lúc deploy:** chạy `manage.py migrate` như một bước riêng trước khi up backend mới (một service one-shot trong compose hoặc lệnh trong deploy workflow) — không nhét vào entrypoint của cả 3 worker gunicorn chạy đua nhau.
- **Log:** driver mặc định json-file nhưng **phải giới hạn** (`max-size: "10m"`, `max-file: "3"`) — không giới hạn thì log ăn đầy disk sau vài tháng (SPEC §13 đã ghi).

### 1.8 CI/CD — deploy workflow

CI đã có (`.github/workflows/ci.yml`: lint + test cả 2 phía). Phase 5 thêm `deploy.yml`, nguyên lý: **máy bạn không bao giờ deploy tay — GitHub Actions làm mọi thứ khi push main**:

```
push main → CI xanh → build 2 image → push GHCR
         → SSH vào VPS → docker compose pull → migrate → up -d
         → curl https://domain/api/v1/health  (fail → workflow đỏ, biết ngay)
```

Cần chuẩn bị: GitHub repo **Secrets** chứa `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key riêng cho deploy, không dùng key cá nhân). Bước SSH dùng action như `appleboy/ssh-action` chạy đúng 3–4 lệnh trên VPS.

Downtime: `compose up -d` recreate container → app đứng vài giây. **Chấp nhận được cho MVP** — zero-downtime là bài của Level 2 (Phần 3).

Điểm hay bị kẹt: GHCR mặc định private → VPS phải `docker login ghcr.io` một lần bằng Personal Access Token (scope `read:packages`), hoặc set package thành public.

### 1.9 Backup & restore

**Backup chưa test restore = chưa có backup.** Kế hoạch theo SPEC §13:

1. **Hằng ngày trên VPS:** cron chạy `docker compose exec -T db pg_dump -U vocab vocab | gzip > backup-$(date +%F).sql.gz`, xóa file cũ hơn 7 ngày (`find ... -mtime +7 -delete`).
2. **Offsite (bắt buộc trước launch):** VPS chết/bị xóa là mất cả backup nếu chỉ để tại chỗ. Dùng `rclone` đẩy lên object storage (Backblaze B2 rẻ nhất, S3 tương đương) ngay sau bước dump, trong cùng cron script.
3. **Test restore 1 lần (success criterion #11):** tạo database rỗng, `gunzip -c backup.sql.gz | docker compose exec -T db psql -U vocab -d vocab_restore_test`, đếm số rows vài bảng so với thật. Ghi lại các lệnh thành `docs/restore-runbook.md` — lúc sự cố thật không phải lúc mò lệnh.

Database là thứ **duy nhất** không tái tạo được. Code ở git, image ở GHCR, WordCache có thể enrich lại — chỉ dữ liệu user là mất là hết.

### 1.10 Giám sát tối thiểu

MVP chỉ cần trả lời được "app có đang sống không, chết thì tôi có biết không":

- **`GET /api/v1/health`** (đã có từ Task 1) — làm điểm kiểm cho cả deploy verify lẫn uptime check.
- **UptimeRobot** (free): ping health endpoint 5 phút/lần, chết → email/telegram. Setup 5 phút, làm ngay sau khi có HTTPS.
- **Xem log khi có chuyện:** `docker compose logs -f backend worker` — đủ cho giai đoạn này.
- **Sentry** (error tracking, free tier) — đáng làm sớm ở v1.1: exception nào user gặp trên prod đều báo về kèm stack trace, thay vì đợi user phàn nàn. Chưa bắt buộc cho launch.

---

## Phần 2 — Roadmap thực thi Phase 5 cho project này

### Bước 0 — Chuẩn bị (ngoài code, làm trước tất cả)

- [ ] Mua VPS (2GB RAM, Ubuntu 24.04 LTS) — Hetzner/DigitalOcean/Vultr, hoặc nhà cung cấp VN nếu ưu tiên độ trễ
- [ ] Mua domain, trỏ A record → IP VPS, verify bằng `dig`
- [ ] Hardening VPS theo mục 1.1 (SSH key, user `deploy`, UFW, unattended-upgrades, fail2ban)
- [ ] Cài Docker Engine + compose plugin trên VPS (script chính chủ `get.docker.com`)
- [ ] Google OAuth: thêm `https://yourdomain.com` vào Authorized origins
- [ ] Quyết định đích backup offsite (SPEC Open Q #5 — đề xuất Backblaze B2) và tạo bucket

### Bước 1 — Task 20: Docker prod + Nginx (làm và test **hoàn toàn ở local** trước)

1. `backend/Dockerfile` — multi-stage: uv sync → copy source → `collectstatic` → chạy gunicorn. Thêm whitenoise cho static admin.
2. `frontend/Dockerfile` — bật `output: "standalone"` trong `next.config.ts`, multi-stage: pnpm build → copy `.next/standalone`.
3. `config/settings/prod.py` — rà theo bảng mục 1.6, chạy `manage.py check --deploy` sạch cảnh báo.
4. `docker-compose.yml` (prod) ở root — 6 service: nginx, frontend, backend, worker, db, redis. Chỉ nginx có `ports`; volume cho pgdata; healthcheck + depends_on; restart policy; log limits; bước migrate.
5. `nginx/` config theo mục 1.4 (giai đoạn local test chưa cần TLS — listen 80).
6. **Verify AC Task 20 tại local:** `docker compose up -d` → mở `http://localhost` đi hết luồng login → thêm từ → enrichment chạy (worker log) → review. Đây là lần diễn tập không mất gì — đừng bỏ qua để lên thẳng VPS.

### Bước 2 — Task 21: Deploy workflow + HTTPS + backup

1. Chép `docker-compose.yml` + tạo `.env` prod trên VPS (secrets mới, không tái dùng dev). `docker login ghcr.io`.
2. Deploy tay **lần đầu** trên VPS (pull image build tay hoặc từ CI) — hiểu từng lệnh trước khi tự động hóa nó.
3. Certbot → HTTPS + auto-renew (`renew --dry-run`); cập nhật nginx listen 443.
4. `.github/workflows/deploy.yml` theo mục 1.8 + GitHub Secrets. Push main → xem workflow chạy → health 200.
5. Cron backup hằng ngày + rclone offsite (mục 1.9). Setup UptimeRobot.
6. **Verify AC Task 21:** sửa 1 dòng bất kỳ, push main → VPS tự cập nhật, `https://domain/api/v1/health` trả 200.

### Bước 3 — Task 22: Launch checklist

1. Chạy đủ **11 success criteria** (SPEC §14) trên VPS thật — đặc biệt #2/#3 cần `GEMINI_API_KEY` thật, #10, #11.
2. Test restore backup theo runbook (mục 1.9) — bắt buộc trước khi mời người dùng thật.
3. Rà OAuth verification nếu mở công khai (SPEC Open Q #4 — app chưa verify sẽ hiện màn hình cảnh báo với user ngoài, giới hạn 100 test users).

> Thứ tự học đề xuất trước khi code Task 20: đọc mục 1.5 → 1.7 (Docker/gunicorn/standalone là phần mới nhất với bạn), rồi 1.4; các mục còn lại đọc khi chạm tới bước tương ứng.

---

## Phần 3 — Lộ trình nâng cao sau launch

Mỗi level chỉ đáng làm khi có lý do thật (nhiều user hơn, đau tay vận hành hơn) — không làm trước để "cho chuyên nghiệp".

### Level 2 — Vận hành tử tế (1–3 tháng sau launch, vẫn 1 VPS)

| Việc | Giải quyết đau gì |
|---|---|
| **Sentry** (backend + frontend) | Biết lỗi prod trước khi user báo; nhìn được stack trace thật |
| **Zero-downtime deploy** — chạy 2 container backend, nginx upstream chuyển dần; hoặc tối thiểu `--wait` + healthcheck để up bản mới xong mới hạ bản cũ | Deploy giờ cao điểm không văng user đang ôn tập |
| **Staging environment** — compose thứ 2 trên cùng VPS, subdomain riêng, deploy từ branch | Thử migration/feature nguy hiểm không đụng dữ liệu thật |
| **Migration an toàn** — quy tắc backward-compatible (thêm cột nullable trước, backfill, rồi mới siết) | Migrate fail giữa chừng không làm chết bản đang chạy |
| **Quản lý secrets tốt hơn** — SOPS + age, hoặc tối thiểu bản mã hóa trong private repo | `.env` trên VPS là bản duy nhất — mất VPS là mất config |
| **Giám sát tài nguyên** — `node_exporter` + Grafana Cloud free, hoặc đơn giản `docker stats` + alert disk qua cron | Biết trước khi disk đầy / RAM cạn, không phải sau |

### Level 3 — Trình độ cao (chỉ khi sản phẩm lớn thật)

- **Infrastructure as Code:** Ansible playbook tái tạo toàn bộ VPS setup (mục 1.1 + Docker + cron) bằng 1 lệnh — VPS cháy thì dựng lại trong 30 phút thay vì nhớ tay. Terraform khi cần provision nhiều máy/cloud resources.
- **Tách database ra managed service** (RDS, DO Managed PG): backup/failover/upgrade thành việc của nhà cung cấp. Đây là bước scale **đầu tiên** nên làm — trước cả việc thêm server.
- **Nhiều server + load balancer:** app server stateless (JWT + Postgres/Redis chứa state sẵn rồi — kiến trúc hiện tại đã sẵn sàng), nhân bản backend/worker theo tải.
- **Observability đầy đủ:** Prometheus + Grafana (metrics), Loki (log tập trung), tracing (OpenTelemetry) — trả lời "request chậm vì đâu" thay vì chỉ "sống hay chết".
- **Kubernetes:** chỉ khi vận hành nhiều app/nhiều team hoặc cần autoscale thật; với 1 sản phẩm 1 team, Compose (hoặc Docker Swarm) + IaC đi rất xa. Học để biết thì tốt, migrate thì cần lý do.
- **CDN (Cloudflare):** cache static + chặn DDoS tầng ngoài; với app cá nhân hóa như SRS, lợi ích chính là bảo vệ + TLS, không phải cache.

### Kỹ năng nền song song

- Đọc thành thạo: `journalctl`, `docker compose logs`, `docker stats`, `df -h`, `htop` — 5 lệnh chẩn đoán 90% sự cố VPS.
- Viết **runbook** cho mỗi quy trình sự cố (restore DB, rollback deploy, cert hết hạn) — vận hành trình độ cao khác trình độ thấp ở chỗ sự cố xử theo checklist, không theo trí nhớ.
- Nguyên tắc 12-factor app (12factor.net) — codebase này đã theo sẵn phần lớn (config qua env, stateless process, log ra stdout); đọc để gọi tên được những gì mình đang làm đúng.
