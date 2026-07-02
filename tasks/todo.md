# Todo — Vocab English MVP

> Chi tiết từng task (AC, verify, deps): `tasks/plan.md`

## Phase 0 — Nền móng
- [x] Task 1: Khởi tạo repo + Django skeleton (M)
- [x] Task 2: Next.js skeleton (M) — Next.js 16 (spec đã cập nhật)
- [x] Task 3: CI GitHub Actions (S)
- [x] ✅ Checkpoint 0: dev env trọn vẹn, CI xanh (run 28595289802)

## Phase 1 — Auth (story 1)
- [ ] Task 4: accounts models — User + UserSettings (M)
- [ ] Task 5: Auth API + error format nền (M)
- [ ] Task 6: Login UI + auth client (M)
- [ ] ✅ Checkpoint 1: success criterion #1

## Phase 2 — Deck, từ vựng, AI enrichment (stories 2,3,4)
- [ ] Task 7: vocab models + normalize_word (M)
- [ ] Task 8: Deck API (S)
- [ ] Task 9: Deck UI (M)
- [ ] Task 10: Enrichment providers — Gemini + Fake (M, song song 8-9)
- [ ] Task 11: Enrich service + Celery task (M)
- [ ] Task 12: Words API (M)
- [ ] Task 13: Words UI (M)
- [ ] ✅ Checkpoint 2: success criteria #2, 3, 4, 8, 9

## Phase 3 — SRS (story 5)
- [ ] Task 14: SM-2 engine thuần, coverage 100% (S, song song phase 2 được)
- [ ] Task 15: ReviewLog + queue + answer API (M)
- [ ] Task 16: Review UI — typing → flip → 4 nút + TTS (M–L)
- [ ] ✅ Checkpoint 3: success criterion #5

## Phase 4 — Settings & Stats (stories 6,7)
- [ ] Task 17: Settings API + UI (M) — criterion #6
- [ ] Task 18: Stats API (S–M)
- [ ] Task 19: Stats UI (S–M) — ⚠️ chart lib mới phải hỏi trước
- [ ] ✅ Checkpoint 4: success criterion #7

## Phase 5 — Production & launch
- [ ] Task 20: Docker prod + Nginx 1 domain (M)
- [ ] Task 21: Deploy workflow + backup pg_dump (M) — cần VPS/domain
- [ ] Task 22: Launch checklist — 11/11 criteria + restore test (S)
- [ ] ✅ Checkpoint 5: success criteria #10, 11 → MVP hoàn thành

## Prerequisites (ngoài code)
- [x] Tạo GitHub repo (trước task 3) — github.com/baopd79/vocab-english-fable (private)
- [x] Google OAuth Client ID (trước task 5) — đã lưu trong .env (gitignored)
- [x] Gemini API key (trước checkpoint 2) — đã lưu trong .env (gitignored)
- [ ] Domain + VPS (trước task 21)
