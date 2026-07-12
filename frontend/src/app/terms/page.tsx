import type { Metadata } from "next";
import Link from "next/link";

import { LegalList, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng — Vocabun",
  description: "Điều kiện sử dụng dịch vụ học từ vựng Vocabun.",
};

const CONTACT_EMAIL = "baocrayon99@gmail.com";

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản sử dụng" effectiveDate="12/07/2026">
      <LegalSection title="1. Dịch vụ">
        <p>
          Vocabun (vocabun.com) là công cụ học từ vựng tiếng Anh với sự hỗ trợ của AI: bạn thêm từ,
          hệ thống tạo nghĩa và ví dụ, rồi xếp lịch ôn tập ngắt quãng. Dịch vụ hiện được cung cấp
          miễn phí, ở trạng thái &ldquo;nguyên trạng&rdquo; (as is). Bằng việc sử dụng Vocabun, bạn
          đồng ý với các điều khoản dưới đây và{" "}
          <Link className="text-primary-text font-semibold hover:underline" href="/privacy">
            Chính sách quyền riêng tư
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Tài khoản">
        <p>
          Bạn đăng nhập bằng tài khoản Google của mình và chịu trách nhiệm cho hoạt động diễn ra
          trong tài khoản đó. Mỗi người chỉ nên dùng một tài khoản.
        </p>
      </LegalSection>

      <LegalSection title="3. Sử dụng chấp nhận được">
        <LegalList>
          <li>
            Không can thiệp hay phá hoại hệ thống: dò quét lỗ hổng, vượt giới hạn tần suất, truy cập
            dữ liệu của người dùng khác, tự động hoá bất thường.
          </li>
          <li>Không dùng dịch vụ cho mục đích trái pháp luật.</li>
          <li>
            Nội dung bạn nhập (từ vựng, ghi chú) không được vi phạm pháp luật hay quyền của người
            khác.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Nội dung do AI tạo">
        <p>
          Nghĩa, phiên âm và câu ví dụ được tạo tự động bởi AI nên có thể sai, thiếu ngữ cảnh hoặc
          không phù hợp trong một số trường hợp. Hãy dùng chúng như tài liệu tham khảo học tập,
          không phải nguồn chuẩn mực.
        </p>
      </LegalSection>

      <LegalSection title="5. Dữ liệu của bạn">
        <p>
          Từ vựng và ghi chú bạn nhập thuộc về bạn. Bạn cho phép Vocabun lưu trữ và xử lý chúng nhằm
          cung cấp dịch vụ (chi tiết trong Chính sách quyền riêng tư). Nội dung do AI tạo từ một từ
          tiếng Anh nằm trong kho dữ liệu chung của hệ thống và không gắn với danh tính của bạn.
        </p>
      </LegalSection>

      <LegalSection title="6. Giới hạn trách nhiệm">
        <p>
          Vocabun là dự án cá nhân cung cấp miễn phí: không cam kết dịch vụ hoạt động liên tục hay
          dữ liệu không bao giờ mất (dù hệ thống được sao lưu hằng ngày). Trong phạm vi pháp luật
          cho phép, Vocabun không chịu trách nhiệm cho các thiệt hại gián tiếp phát sinh từ việc sử
          dụng dịch vụ.
        </p>
      </LegalSection>

      <LegalSection title="7. Chấm dứt">
        <p>
          Tài khoản vi phạm điều khoản có thể bị tạm khoá hoặc chấm dứt. Bạn có thể ngừng sử dụng
          bất cứ lúc nào và yêu cầu xoá toàn bộ dữ liệu theo hướng dẫn trong Chính sách quyền riêng
          tư.
        </p>
      </LegalSection>

      <LegalSection title="8. Thay đổi điều khoản">
        <p>
          Điều khoản có thể được cập nhật; ngày hiệu lực mới luôn ở đầu trang. Tiếp tục sử dụng dịch
          vụ sau khi điều khoản thay đổi nghĩa là bạn đồng ý với bản mới.
        </p>
      </LegalSection>

      <LegalSection title="9. Luật áp dụng và liên hệ">
        <p>
          Các điều khoản này được điều chỉnh theo pháp luật Việt Nam. Mọi câu hỏi gửi về{" "}
          <a
            className="text-primary-text font-semibold hover:underline"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
