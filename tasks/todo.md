# Todo — Vocab English MVP

> Chi tiết từng task (AC, verify, deps): `tasks/plan.md`

## Phase 0 — Nền móng
- [x] Task 1: Khởi tạo repo + Django skeleton (M)
- [x] Task 2: Next.js skeleton (M) — Next.js 16 (spec đã cập nhật)
- [x] Task 3: CI GitHub Actions (S)
- [x] ✅ Checkpoint 0: dev env trọn vẹn, CI xanh (run 28595289802)

## Phase 1 — Auth (story 1)
- [x] Task 4: accounts models — User + UserSettings (M)
- [x] Task 5: Auth API + error format nền (M)
- [x] Task 6: Login UI + auth client (M)
- [x] ✅ Checkpoint 1: success criterion #1 — login Google thật OK (2026-07-02)

## Phase 2 — Deck, từ vựng, AI enrichment (stories 2,3,4)
- [x] Task 7: vocab models + normalize_word (M)
- [x] Task 8: Deck API (S)
- [x] Task 9: Deck UI (M)
- [x] Task 10: Enrichment providers — Gemini + Fake (M, song song 8-9)
- [x] Task 11: Enrich service + Celery task (M)
- [x] Task 12: Words API (M)
- [x] Task 13: Words UI (M)
- [x] ✅ Checkpoint 2: success criteria #2, 3, 4, 8, 9 — verify sống với Gemini thật (2026-07-04)

## Phase 3 — SRS (story 5)
- [x] Task 14: SM-2 engine thuần, coverage 100% (S, song song phase 2 được)
- [x] Task 15: ReviewLog + queue + answer API (M)
- [x] Task 16: Review UI — typing → flip → 4 nút + TTS (M–L)
- [x] ✅ Checkpoint 3: success criterion #5 — queue/quota + typing→flip + 4 nút SM-2 + Again re-queue (smoke live 2026-07-04)

## Phase 4 — Settings & Stats (stories 6,7)
- [x] Task 17: Settings API + UI (M) — criterion #6
- [x] Task 18: Stats API (S–M)
- [x] Task 19: Stats UI (S–M) — SVG thuần, không thêm dep
- [x] ✅ Checkpoint 4: success criterion #7 — stats hiển thị đúng (3 trạng thái + streak + daily chart)

## Phase 5 — Production & launch
- [x] Task 20: Docker prod + Nginx 1 domain (M) — verify local: full flow qua nginx :80 (2026-07-09)
- [x] Task 21: Deploy workflow + backup pg_dump (M) — vocabun.com sống: push main → auto deploy, HTTPS certbot, cron pg_dump 7 bản (2026-07-09)
- [x] Task 22: Launch checklist — 11/11 criteria trên vocabun.com + backup offsite B2 + restore test OK + UptimeRobot (2026-07-09)
- [x] ✅ Checkpoint 5: success criteria #10, 11 → **MVP hoàn thành 2026-07-09** 🏁

## Prerequisites (ngoài code)
- [x] Tạo GitHub repo (trước task 3) — github.com/baopd79/vocab-english-fable (private)
- [x] Google OAuth Client ID (trước task 5) — đã lưu trong .env (gitignored)
- [x] Gemini API key (trước checkpoint 2) — đã lưu trong .env (gitignored)
- [x] Domain + VPS (trước task 21) — vocabun.com + DigitalOcean Singapore 1GB (2026-07-09)
