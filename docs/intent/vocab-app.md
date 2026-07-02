# Intent: Web app học từ vựng tiếng Anh cho người Việt

> Chốt ngày 2026-07-02 qua interview. Đây là mốc tham chiếu cho mọi quyết định scope về sau.

- **Outcome:** Web app học từ vựng tích hợp AI, launch công khai, tự host VPS.
- **User:** Người Việt học tiếng Anh; builder là solo dev (nền FastAPI) muốn học Django qua dự án thật.
- **Why now:** Vừa xây sản phẩm thật vừa học stack mới, tự chủ hạ tầng trên VPS.
- **Success:** MVP chạy đủ 7 user story (xem SPEC.md mục 1) trên VPS; kiến trúc mở rộng được (batch import, đổi AI provider, deck công khai) mà không refactor lớn.
- **Constraint:** Solo dev, 1 Gemini API key chung (builder chịu chi phí), timeline linh hoạt, không over-engineer.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Stack | Next.js + Django/DRF + PostgreSQL + Celery/Redis |
| Auth | Google OAuth only (bỏ email/password) |
| AI | Gemini, adapter pattern để đổi provider; sinh: từ loại, IPA, nghĩa VI, ví dụ + dịch |
| Enrichment | Async qua Celery; global word cache trong schema ngay từ đầu |
| SRS | SM-2, 4 nút kiểu Anki; giới hạn ngày user tự chỉnh trong profile |
| Rate limit | DRF throttling per-user + Celery rate_limit ra Gemini |
| Deploy | Docker Compose trên VPS, domain + HTTPS, CI/CD GitHub Actions |

## Out of scope (MVP)

Batch import (dán text/file/URL) · deck công khai/chia sẻ · email/password · gamification · mobile app · notification · thanh toán
