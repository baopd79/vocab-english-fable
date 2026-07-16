# Todo — Vocabun

> MVP: chi tiết task trong `tasks/plan.md` · v1.1: chi tiết trong `tasks/plan-v1.1.md`

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

---

# v1.1 — "Mở cửa đón khách" (scope khóa 2026-07-11, SPEC §17)

## Giai đoạn 1 — Tên mới + vá móng
- [x] Task 1: Rebrand "Vocabun" (S) — code xong 2026-07-12; popup Google chờ user đổi tên trên Console
- [x] Task 2: Fix A1 — xoá query cache khi logout/login (S) — 2026-07-12, `queryClient.clear()` ở cả logout lẫn login + 2 vitest
- [x] Task 3: Hardening — throttle auth + bảo vệ /admin (S) — Q7 chốt basic-auth; verify prod 2026-07-12: /admin 401, request thứ 61 vào /auth/refresh dính 429
- [x] ✅ Checkpoint 6a: bug user báo đã hết trên prod, cửa hậu khoá (2026-07-13: user verify đổi tài khoản sạch cache; /admin 401; auth 429)

## Giai đoạn 2 — Cổng public (nộp Google sớm)
- [x] Task 4: Trang Privacy Policy + Terms (M) — 2026-07-12: /privacy + /terms 200 ẩn danh trên prod, footer toàn cục + dòng đồng ý ở login
- [x] Task 5: Nộp Google OAuth verification (M) — consent screen + publish 2026-07-12; 2026-07-13 tài khoản ngoài Test users login OK → app "In production" (§17.2-1 đạt)
- [x] Task 6: Gemini tier + trần chi phí toàn hệ thống (S–M) — Q6 chốt 2026-07-14: free tier (RPM 5/RPD 20), trần env GEMINI_DAILY_BUDGET=18 theo ngày Pacific + 429 ai_budget_exceeded + rate_limit 4/m; verify dev (trần=1) 2026-07-15
- [x] ✅ Checkpoint 6: verification đã nộp, chi phí AI có trần (2026-07-15 — Giai đoạn 2 xong)

## Giai đoạn 3 — UX polish
- [x] Task 7: Card deck click toàn bộ + voice mọi nơi — B1, B2, F7 (S–M) — 2026-07-12, user smoke localhost OK (voice + card click + nút không bubble)
- [x] Task 8: Màn hình tổng quan trước phiên ôn — B3 (S–M) — 2026-07-12, queue API thêm `decks` breakdown (đếm theo quota), /review có màn "Bắt đầu ôn"
- [x] Task 9: Sound + hiệu ứng feedback — B4 (M) — Q5 chốt WebAudio + localStorage; 2026-07-12: chime chấm điểm, fanfare + confetti, mute toggle
- [x] ✅ Checkpoint 7: 3 điểm đau UX user nêu đã hết trên prod (2026-07-13: user smoke T7/T8/T9 OK — voice, overview, sound/confetti/mute)

## Giai đoạn 4 — Feature học tập
- [x] Task 10: Quick-add từ ở header (M) — Q2 chốt: nút "+" header + modal giữ mở, list "Vừa thêm" live, card deck có "+ Từ", khung 1280px; verify prod 2026-07-13
- [x] Task 11: Heatmap ôn tập — F8 (S) — GET /stats/heatmap 365 ngày (đếm mọi lượt ôn) + SVG grid kiểu GitHub; verify prod 2026-07-14
- [x] Task 12: Cram mode — F4 (S–M) — /decks/[id]/cram: cả deck xáo trộn, gõ + tự chấm local; test khẳng định phiên chỉ GET (DB không đổi); verify prod 2026-07-14
- [x] Task 13: Dạng ôn mới — thiết kế + backend (M) — Q1 chốt: MCQ + nghe-gõ dùng chung lịch SM-2, xoay `repetitions % 3` từ rep 2; ReviewLog.mode + queue trả `review_mode`/`mcq_choices`; migration verify trên bản sao data prod (2026-07-14)
- [x] Task 14: Dạng ôn mới — frontend (M–L) — 2026-07-14 smoke prod đủ 2 dạng (TTS câm hóa ra do engine Chrome kẹt, quit mở lại là chạy; speak() thêm resume() chống kẹt)
- [x] ✅ Checkpoint 8: toàn bộ feature học tập chạy trên prod (2026-07-14)

## Giai đoạn 5 — Nội dung & chia sẻ
- [x] Task 15: Starter decks — F1 (M) — Q3 chốt 2026-07-15; 2026-07-16: deploy + seed prod (600 từ, WordCache provider=seed), user verify clone + ôn ngay được
- [ ] Task 16: Deck công khai / chia sẻ — F2 (M) — chốt Q4 trước

## Giai đoạn 6 — Đón khách & công bố
- [ ] Task 17: Landing page — P4 (M)
- [ ] Task 18: Onboarding + empty states — P5 (S–M)
- [ ] Task 19: Sentry — P6 (S)
- [ ] Task 20: Launch checklist v1.1 — 27 tiêu chí (M, công bố cần Task 5 approved)
- [ ] ✅ Checkpoint 9: v1.1 công bố — Vocabun mở cửa cho mọi người 🎉

## Prerequisites v1.1 (ngoài code)
- [x] Đổi tên app trong Google Console consent screen (trước task 1-verify) — 2026-07-12, cùng lượt điền consent screen Task 5
- [x] Quyết định Gemini tier từ usage thật (trước task 6) — 2026-07-14: ở lại free tier tới khi có user thật
- [ ] Tài khoản Sentry free + 2 DSN (trước task 19)
- [x] Chốt nguồn từ vựng starter decks (trước task 15) — 2026-07-15: bộ Anki 4000 Essential Words Book 1 của user, convert offline, ví dụ tự soạn
