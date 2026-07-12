import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư — Vocabun",
  description: "Vocabun thu thập dữ liệu gì, dùng để làm gì và bạn kiểm soát ra sao.",
};

const CONTACT_EMAIL = "baocrayon99@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Chính sách quyền riêng tư" effectiveDate="12/07/2026">
      <LegalSection title="1. Vocabun là gì">
        <p>
          Vocabun (vocabun.com) là ứng dụng học từ vựng tiếng Anh với sự hỗ trợ của AI, được một nhà
          phát triển cá nhân tại Việt Nam vận hành. Chính sách này mô tả dữ liệu nào được thu thập
          khi bạn dùng Vocabun, dùng để làm gì và bạn kiểm soát ra sao. Mọi thắc mắc gửi về{" "}
          <a
            className="text-primary-text font-semibold hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Dữ liệu được thu thập">
        <LegalList>
          <li>
            <strong>Từ tài khoản Google khi bạn đăng nhập:</strong> địa chỉ email, tên hiển thị và
            ảnh đại diện. Vocabun không bao giờ thấy hay lưu mật khẩu Google của bạn.
          </li>
          <li>
            <strong>Dữ liệu bạn tạo trong ứng dụng:</strong> bộ từ, từ vựng, lịch sử ôn tập và cài
            đặt cá nhân (múi giờ, chỉ tiêu học mỗi ngày).
          </li>
          <li>
            <strong>Dữ liệu kỹ thuật:</strong> cookie phiên đăng nhập (mục 4) và log máy chủ cơ bản
            (địa chỉ IP, thời điểm truy cập) phục vụ chống lạm dụng.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Dữ liệu được dùng để làm gì">
        <p>
          Chỉ để vận hành các tính năng của Vocabun: đăng nhập, xếp lịch ôn tập ngắt quãng, thống kê
          tiến độ và chuỗi ngày học. Vocabun <strong>không bán dữ liệu</strong>, không chạy quảng
          cáo và không chia sẻ dữ liệu của bạn cho bên thứ ba nào ngoài các dịch vụ hạ tầng liệt kê
          ở mục 5.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookie và lưu trữ cục bộ">
        <LegalList>
          <li>
            Một cookie <code>refresh_token</code> (httpOnly, sống 7 ngày) để duy trì phiên đăng
            nhập. Cookie này chỉ được gửi tới máy chủ Vocabun, không dùng để theo dõi.
          </li>
          <li>Trình duyệt lưu lựa chọn giao diện sáng/tối của bạn (localStorage).</li>
          <li>Không có cookie quảng cáo hay cookie theo dõi của bên thứ ba.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Dịch vụ bên thứ ba">
        <LegalList>
          <li>
            <strong>Google Sign-In</strong> — xác thực đăng nhập (phạm vi: openid, email, profile).
          </li>
          <li>
            <strong>Google Gemini</strong> — khi bạn thêm một từ, chỉ duy nhất từ tiếng Anh đó
            (không kèm email, tên hay bất kỳ dữ liệu cá nhân nào) được gửi tới Gemini để tạo nghĩa,
            phiên âm và câu ví dụ. Kết quả được lưu vào kho dữ liệu chung phục vụ mọi người dùng,
            không gắn với danh tính của bạn.
          </li>
          <li>
            <strong>Hạ tầng:</strong> máy chủ đặt tại Singapore (DigitalOcean); bản sao lưu định kỳ
            được lưu trên Backblaze B2.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Lưu giữ và xoá dữ liệu">
        <p>
          Dữ liệu của bạn được giữ cho đến khi bạn xoá. Từ vựng hay bộ từ bị xoá trong ứng dụng sẽ
          bị xoá khỏi cơ sở dữ liệu chính ngay lập tức; các bản sao lưu chứa nó tự hết hạn sau 7
          ngày. Để xoá toàn bộ tài khoản, hãy gửi email từ chính địa chỉ Google bạn dùng đăng nhập
          tới{" "}
          <a
            className="text-primary-text font-semibold hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>{" "}
          — yêu cầu được xử lý trong vòng 7 ngày (tính năng tự xoá tài khoản trong ứng dụng sẽ được
          bổ sung sau).
        </p>
      </LegalSection>

      <LegalSection title="7. Bảo mật">
        <p>
          Toàn bộ kết nối dùng HTTPS. Truy cập máy chủ được giới hạn bằng khoá SSH. Dù vậy, không hệ
          thống nào an toàn tuyệt đối — hãy cân nhắc trước khi lưu thông tin nhạy cảm vào ghi chú từ
          vựng.
        </p>
      </LegalSection>

      <LegalSection title="8. Trẻ em">
        <p>Vocabun không nhắm đến và không chủ đích thu thập dữ liệu của trẻ em dưới 13 tuổi.</p>
      </LegalSection>

      <LegalSection title="9. Thay đổi chính sách">
        <p>
          Khi chính sách thay đổi, trang này được cập nhật cùng ngày hiệu lực mới ở đầu trang. Thay
          đổi lớn sẽ được thông báo trong ứng dụng. Xem thêm{" "}
          <Link className="text-primary-text font-semibold hover:underline" href="/terms">
            Điều khoản sử dụng
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
