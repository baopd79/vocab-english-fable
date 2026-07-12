import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import PrivacyPage from "./privacy/page";
import TermsPage from "./terms/page";

// SPEC §17.1-P1 — the legal pages are static and public (no auth, no data
// fetching), so a plain render must succeed and carry an effective date.

test("privacy page renders with title, effective date and contact email", () => {
  render(<PrivacyPage />);

  expect(
    screen.getByRole("heading", { level: 1, name: "Chính sách quyền riêng tư" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Ngày hiệu lực: 12\/07\/2026/)).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /baocrayon99@gmail\.com/ }).length).toBeGreaterThan(0);
});

test("terms page renders with title and effective date", () => {
  render(<TermsPage />);

  expect(screen.getByRole("heading", { level: 1, name: "Điều khoản sử dụng" })).toBeInTheDocument();
  expect(screen.getByText(/Ngày hiệu lực: 12\/07\/2026/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Chính sách quyền riêng tư" })).toHaveAttribute(
    "href",
    "/privacy",
  );
});

test("site footer links to both legal pages", () => {
  render(<SiteFooter />);

  expect(screen.getByRole("link", { name: "Quyền riêng tư" })).toHaveAttribute("href", "/privacy");
  expect(screen.getByRole("link", { name: "Điều khoản" })).toHaveAttribute("href", "/terms");
});
