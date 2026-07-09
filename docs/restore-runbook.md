# Runbook: Restore database từ backup

> Đã test thật ngày **2026-07-09**: restore bản backup vào Postgres tạm, so số dòng
> từng bảng với DB prod — trùng khớp 100%. Backup chưa test restore = chưa có backup.

## Backup nằm ở đâu

| Nơi | Đường dẫn | Cơ chế |
|---|---|---|
| VPS | `/home/deploy/backups/vocab-YYYY-MM-DD.sql.gz` | cron 19:00 UTC (2h sáng VN) chạy `/usr/local/bin/vocab-backup`: `pg_dump \| gzip`, giữ 7 bản (`find -mtime +7 -delete`), log ở `backups/backup.log` |
| Backblaze B2 (offsite) | bucket `vocabun-backups/db/` | `rclone sync` ở cuối script backup; credentials trong `~/.config/rclone/rclone.conf` (chỉ tồn tại trên VPS) |

## Kịch bản A — DB hỏng/mất data, VPS còn sống

```bash
ssh deploy@146.190.88.71
cd ~/vocab-english-fable
C="docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml --env-file .env.prod"

# 1. Dừng app để không còn kết nối vào DB (db + nginx vẫn chạy)
$C stop backend worker frontend

# 2. Tạo lại database rỗng
$C exec -T db psql -U vocab -d postgres -c "DROP DATABASE vocab;"
$C exec -T db psql -U vocab -d postgres -c "CREATE DATABASE vocab OWNER vocab;"

# 3. Đổ backup vào (thay đúng ngày cần khôi phục)
gunzip -c ~/backups/vocab-YYYY-MM-DD.sql.gz | $C exec -T db psql -q -U vocab -d vocab

# 4. Bật lại và kiểm tra
$C up -d
curl -fsS https://vocabun.com/api/v1/health
```

Nếu bản local đã mất (quá 7 ngày), kéo từ B2 về trước ở bước 3:

```bash
rclone copy b2:vocabun-backups/db/vocab-YYYY-MM-DD.sql.gz ~/backups/
```

## Kịch bản B — mất trắng VPS

1. Dựng VPS mới theo `docs/deploy-guide.md` Phần 2 (Bước 0: hardening + Docker; clone repo; tạo `.env.prod` — **POSTGRES_PASSWORD có thể đặt mới**, DB restore không phụ thuộc password cũ; certbot).
2. Cấu hình lại rclone bằng key trên Backblaze dashboard (hoặc tạo application key mới): `rclone config create b2 b2 account <keyID> key <applicationKey>`.
3. Kéo backup về: `rclone copy b2:vocabun-backups/db ~/backups/`.
4. `up -d db redis` → làm bước 2–4 của kịch bản A (bỏ `migrate` — schema nằm sẵn trong file dump).
5. Trỏ lại A record `vocabun.com` nếu IP đổi; đợi DNS rồi chạy lại certbot.

## Kiểm tra định kỳ (mỗi 1–2 tháng)

```bash
ls -lh ~/backups/                 # còn đủ 7 bản, dung lượng tăng dần theo data?
tail ~/backups/backup.log         # cron đêm qua có lỗi không?
rclone ls b2:vocabun-backups      # bản mới nhất đã lên B2?
gunzip -t ~/backups/vocab-*.sql.gz && echo OK   # file không hỏng?
```
