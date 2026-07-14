# Kế hoạch triển khai: Vocabun v1.1 — "Mở cửa đón khách"

> **Nguồn:** SPEC.md mục 17 (chốt scope 2026-07-11) · Checklist tiến độ: `tasks/todo.md` (mục v1.1)
> **Nguyên tắc:** giữ nhịp MVP — lát cắt dọc, task cỡ S/M, checkpoint sau mỗi giai đoạn, việc chờ-bên-thứ-ba (Google verification) nộp sớm nhất có thể. Open questions (SPEC §17.3) chốt qua hỏi-đáp **ngay trước khi code task tương ứng**.

## Context

MVP live tại vocabun.com (22 task, checkpoint 5, 2026-07-09). v1.1 là một bản release duy nhất ~20 task: fix bug thật user gặp, nâng UX học tập, và toàn bộ chuỗi public-readiness. Khác MVP: **push main = deploy production ngay**, nên task nào chưa muốn user thấy phải ship ở trạng thái hoàn chỉnh (không có feature flag system — cắt task đủ nhỏ để mỗi lần merge là một thứ dùng được).

## Dependency graph

```
[G1] T1 rebrand ─→ T4 privacy/terms ─→ T5 nộp OAuth verification (chờ Google, không chặn ai)
     T2 fix cache · T3 hardening        T6 Gemini tier + trần chi phí
        │
[G3] T7 voice mọi nơi + card click → T8 pre-review screen → T9 sound/feedback effects
        │
[G4] T10 quick-add · T11 heatmap · T12 cram ─→ T13 dạng ôn mới BE ─→ T14 dạng ôn mới FE
        │
[G5] T15 starter decks ─→ T16 deck công khai (dùng chung visibility/clone)
        │
[G6] T17 landing ─→ T18 onboarding (cần T15) → T19 Sentry → T20 launch checklist (cần T5 approved để công bố)
```

## Prerequisites (ngoài code)

| Cần | Cho task | Ghi chú |
|---|---|---|
| Đổi tên app trong Google Console (consent screen) | T1 | user thao tác, có hướng dẫn |
| Quyết định Gemini tier (SPEC §17.3-Q6) | T6 | nhìn usage thật trên console Gemini |
| Tài khoản Sentry (free tier) + 2 DSN | T19 | user tạo, DSN vào `.env.prod` |
| Nguồn từ vựng starter decks (SPEC §17.3-Q3) | T15 | chốt trước khi seed |

## Task list

### Giai đoạn 1 — Tên mới + vá móng

**Task 1: Rebrand "Vocabun"** (S, deps: none)
Đổi working title ở FE (header, `<title>`, metadata, login page), SPEC/CLAUDE.md/README refs; hướng dẫn user đổi tên app + logo trên Google consent screen.
- [ ] AC: mọi chỗ user nhìn thấy hiện "Vocabun"; popup Google login hiện "Vocabun"
- Verify: grep "Vocab English" chỉ còn trong docs lịch sử; login thật thấy tên mới.

**Task 2: Fix A1 — xoá cache khi đổi phiên** (S, deps: none)
`queryClient.clear()` khi logout và khi login (auth-context); test đổi tài khoản.
- [ ] AC: SPEC §17.2-4 — đổi tài khoản không thấy data cũ, không cần reload
- [ ] AC: vitest cover logout → cache trống
- Verify: manual 2 tài khoản Google trên localhost + `pnpm test`.

**Task 3: Hardening A2 + A3** (S, deps: none — chốt §17.3-Q7 trước)
Throttle scope riêng (chặt hơn) cho `/api/v1/auth/*`; bảo vệ `/admin` ở nginx theo Q7.
- [ ] AC: spam auth endpoint → 429 trước mức 1000/h; throttle test theo pattern `override_settings` sẵn có
- [ ] AC: §17.2-16 — `/admin` bị chặn từ IP lạ (test bằng 4G điện thoại)
- Verify: `uv run pytest apps/accounts` + curl thật trên prod sau deploy.

- [ ] ✅ **Checkpoint 6a:** bug user báo đã hết trên prod; cửa hậu đã khoá.

### Giai đoạn 2 — Cổng public (nộp Google sớm vì chờ lâu)

**Task 4: Trang Privacy Policy + Terms** (M, deps: 1)
Route FE `/privacy`, `/terms` (tĩnh, tiếng Việt, không cần login), link ở footer + trang login. Nội dung: data thu thập (email, tên, avatar từ Google; từ vựng; log ôn tập), dùng Gemini xử lý từ (không gửi data cá nhân), cookie refresh token, quyền xoá tài khoản (liên hệ email trước khi có nút tự xoá).
- [ ] AC: 2 URL mở được ở chế độ ẩn danh, có ngày hiệu lực
- Verify: mở ẩn danh trên prod; link từ footer hoạt động.

**Task 5: Nộp Google OAuth verification** (M + chờ nhiều tuần, deps: 1, 4)
Consent screen production: tên Vocabun, domain vocabun.com đã verify, link privacy/terms, scope chỉ `openid email profile`. Nộp → theo dõi email Google, phản hồi yêu cầu bổ sung.
- [ ] AC: app chuyển trạng thái "In production"; tài khoản ngoài Test users login được (§17.2-1)
- Verify: login bằng tài khoản Google chưa từng thêm vào Test users.
- **Ghi chú:** task này "treo" trong nhiều tuần — không chặn task nào khác; chỉ chặn *công bố* ở T20.

**Task 6: Gemini tier + trần chi phí toàn hệ thống** (S–M, deps: none — chốt §17.3-Q6 trước)
Chốt free/paid từ usage thật. Thêm global daily cap (counter Redis, reset theo ngày UTC) kiểm tra trong service enrich **trước khi claim** WordCache; chạm trần → fail-as-miss, code `enrichment_budget_exceeded`, FE hiện thông báo thân thiện.
- [ ] AC: §17.2-14; per-user 50/ngày giữ nguyên; unit test cap bằng override counter
- Verify: `uv run pytest apps/enrichment` + hạ trần xuống 1 trên dev rồi thêm 2 từ.

- [ ] ✅ **Checkpoint 6:** verification đã nộp, chi phí AI có trần — nền public sẵn sàng, chỉ còn chờ Google.

### Giai đoạn 3 — UX polish (điểm đau user thật)

**Task 7: Card deck click toàn bộ + voice mọi nơi (B1, B2, F7)** (S–M, deps: none)
Card deck: `<Link>` bọc cả card, nút phụ `stopPropagation`. Nút loa (dùng `lib/tts.ts`): form thêm từ (nghe trước khi lưu), từng hàng trong danh sách từ của deck, câu ví dụ ở cả deck detail lẫn thẻ ôn.
- [ ] AC: §17.2-5, §17.2-6
- [ ] AC: vitest — click vùng card ngoài tên vẫn navigate; nút loa không làm navigate
- Verify: `pnpm test` + manual trên browser thật (TTS không chạy trong jsdom).

**Task 8: Màn hình tổng quan trước phiên ôn (B3)** (S–M, deps: none)
`/review` hiện overview trước: tổng thẻ mới/đến hạn, phân theo deck (selector mở rộng trả breakdown), nút "Bắt đầu ôn". Runner giữ nguyên.
- [ ] AC: §17.2-7; vào `/review` không tự nhảy vào thẻ đầu tiên nữa
- [ ] AC: breakdown theo deck đúng với queue thật (test selector)
- Verify: `uv run pytest apps/srs` + `pnpm test` + manual.

**Task 9: Sound + hiệu ứng feedback (B4)** (M, deps: 8 — chốt §17.3-Q5 trước)
Âm khi chấm đúng/sai (Good/Easy vs Again/Hard), fanfare + hiệu ứng khi xong phiên; toggle mute theo Q5.
- [ ] AC: §17.2-8; mute được nhớ qua reload
- [ ] AC: không phát âm thanh chồng TTS (sequence hợp lý)
- Verify: manual trên browser + vitest cho logic toggle.

- [ ] ✅ **Checkpoint 7:** 3 điểm đau UX user nêu đã hết trên prod.

### Giai đoạn 4 — Feature học tập

**Task 10: Quick-add từ ở header** (M, deps: none — chốt §17.3-Q2 trước)
Nút/lệnh thêm từ nhanh từ mọi trang; chọn deck (nhớ deck gần nhất theo Q2); submit → enrichment như flow thường; modal giữ mở để thêm liên tục, list "Vừa thêm" hiện kết quả AI live; card deck ở /decks có nút "+ Từ" mở cùng modal.
- [x] AC: §17.2-9; validate + lỗi trùng từ hiện ngay trong popup
- Verify: `pnpm test` + manual từ 3 trang khác nhau.

**Task 11: Heatmap ôn tập (F8)** (S, deps: none)
Selector đếm review theo ngày 365 ngày (timezone user, pattern như stats hiện có); SVG grid thuần trong trang stats.
- [x] AC: §17.2-12; ngày không ôn = ô trống, hover thấy số
- Verify: `uv run pytest apps/stats` + manual.

**Task 12: Cram mode (F4)** (S–M, deps: 8)
Từ trang deck (hoặc pre-review screen): "Ôn tự do deck này" → phiên flip tự chấm, **không gọi answer API SM-2**, không ghi ReviewLog, không đụng SRS fields.
- [ ] AC: §17.2-11 — test khẳng định DB không đổi sau phiên cram
- Verify: `uv run pytest` + manual so sánh queue trước/sau cram.

**Task 13: Dạng ôn mới — thiết kế + backend** (M, deps: none — chốt §17.3-Q1 trước, quyết định lớn nhất v1.1)
Chốt 2 dạng + mô hình dữ liệu (dùng chung lịch note hay tách `srs.Card` — nếu tách: migration + backfill). API queue/answer mở rộng field `mode`; engine SM-2 không đổi.
- [ ] AC: §17.2-10 phần backend; `apps/srs/engine.py` giữ 100% coverage
- [ ] AC: migration chạy sạch trên bản sao data prod (dùng backup, theo restore-runbook)
- Verify: `uv run pytest apps/srs` + migrate thử trên dump prod local.

**Task 14: Dạng ôn mới — frontend** (M–L, deps: 13)
UI 2 dạng trong runner (sau màn overview T8, hiệu ứng T9 áp dụng chung).
- [ ] AC: §17.2-10 trọn vẹn trên prod
- Verify: `pnpm test` + smoke live đủ 2 dạng.

- [ ] ✅ **Checkpoint 8:** toàn bộ feature học tập chạy trên prod (tương đương "criterion #5 mở rộng").

### Giai đoạn 5 — Nội dung & chia sẻ

**Task 15: Starter decks (F1)** (M, deps: 6 — chốt §17.3-Q3 trước)
Deck hệ thống đã enrich sẵn (management command seed, chạy trên VPS 1 lần); user "thêm về tài khoản" = clone (không copy SRS, không sửa bản gốc — SPEC §17.4).
- [ ] AC: §17.2-3 phần deck mẫu; clone không tính vào quota enrich của user
- Verify: `uv run pytest apps/vocab` + tài khoản mới clone + ôn được ngay.

**Task 16: Deck công khai / chia sẻ (F2)** (M, deps: 15 — chốt §17.3-Q4 trước)
Bật `visibility` public cho deck user; trang share (URL công khai) xem danh sách từ + nút clone (tái dùng cơ chế clone T15); deck private giữ 404.
- [ ] AC: §17.2-13; test 404 cho deck private với user khác (quy tắc §9 không đổi)
- Verify: `uv run pytest` + share link mở ở trình duyệt ẩn danh.

### Giai đoạn 6 — Đón khách & công bố

**Task 17: Landing page (P4)** (M, deps: 1)
Khách chưa login vào `/` thấy landing (hero, cách hoạt động 3 bước, screenshot, CTA đăng nhập, footer privacy/terms); đã login → dashboard như cũ. SEO meta + Open Graph.
- [ ] AC: §17.2-2; Lighthouse SEO cơ bản không lỗi đỏ
- Verify: ẩn danh thấy landing, login thấy dashboard; share link preview có OG image.

**Task 18: Onboarding + empty states (P5)** (S–M, deps: 15, 17)
User mới: gợi ý 3 bước ở home (thêm starter deck → xem từ → ôn thử); mọi empty state (deck trống, chưa có từ, chưa có lượt ôn, stats trống) có hướng dẫn + CTA.
- [ ] AC: §17.2-3 trọn vẹn: tài khoản mới → ôn được từ đầu tiên ≤2 phút
- Verify: manual bằng tài khoản Google mới tinh trên prod.

**Task 19: Sentry (P6)** (S, deps: none)
SDK backend (django) + frontend (nextjs), DSN qua env (`.env.prod` + build-arg FE nếu cần), release tag theo git SHA, lọc PII mặc định.
- [ ] AC: §17.2-15 — lỗi cố ý từ cả 2 phía hiện trên dashboard, có release tag
- Verify: trigger lỗi test trên prod rồi xoá.

**Task 20: Launch checklist v1.1** (M, deps: tất cả; công bố cần T5 approved)
Chạy lại 11 tiêu chí MVP + 16 tiêu chí §17.2 trên vocabun.com; kiểm RAM/disk sau khi thêm Sentry + traffic thử; cập nhật `docs/ops-map.md` nếu có lệnh vận hành mới; công bố public.
- [ ] AC: 27/27 tiêu chí pass; RAM ổn định dưới ~850MB
- Verify: bảng checklist tick từng mục, như Task 22 MVP.

- [ ] ✅ **Checkpoint 9: v1.1 công bố — Vocabun mở cửa cho mọi người** 🎉

## Thứ tự & ước lượng

Tuần tự đề xuất: G1 → G2 → G3 → G4 → G5 → G6 (trong mỗi giai đoạn theo số task). T5 nộp xong là "đồng hồ Google" chạy song song — mọi giai đoạn sau không phụ thuộc nó, chỉ T20 (công bố) cần nó approved. Tổng ~20 task: nếu giữ nhịp MVP (~3 task/ngày làm tập trung) ≈ 7–10 ngày code + thời gian chờ Google verification.
