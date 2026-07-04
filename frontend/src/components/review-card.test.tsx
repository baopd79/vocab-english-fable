import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import type { UserWord } from "@/lib/words";

import { ReviewCard } from "./review-card";

function card(overrides: Partial<UserWord> = {}): UserWord {
  return {
    id: 1,
    deck: 1,
    word_text: "serendipity",
    part_of_speech: "noun",
    ipa: "/ˌsɛrənˈdɪpɪti/",
    meaning_vi: "sự tình cờ may mắn",
    example_en: "A happy serendipity.",
    example_vi: "Một sự tình cờ may mắn.",
    enrichment_status: "completed",
    ease_factor: 2.5,
    interval_days: 6,
    repetitions: 2,
    due_at: "",
    first_reviewed_at: "2026-06-01T00:00:00Z",
    last_reviewed_at: "2026-06-20T00:00:00Z",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

test("old card: type correct → flip shows the word and grading calls back", () => {
  const onGrade = vi.fn();
  render(<ReviewCard card={card()} onGrade={onGrade} />);

  // Recall prompt shows the meaning, not the word yet.
  expect(screen.getByText("sự tình cờ may mắn")).toBeInTheDocument();
  expect(screen.queryByText("serendipity")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Đáp án"), { target: { value: "Serendipity" } });
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));

  expect(screen.getByText("serendipity")).toBeInTheDocument();
  expect(screen.getByText("Chính xác!")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith("good");
});

test("old card: wrong typing suggests Again after flip", () => {
  render(<ReviewCard card={card()} onGrade={vi.fn()} />);

  fireEvent.change(screen.getByLabelText("Đáp án"), { target: { value: "serendipty" } });
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));

  expect(screen.getByText(/chưa đúng/i)).toBeInTheDocument();
  expect(screen.getByText("Again", { selector: "strong" })).toBeInTheDocument();
});

test("new card: no typing step, starts flipped", () => {
  const onGrade = vi.fn();
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={onGrade} />);

  // No recall input; the word is shown immediately.
  expect(screen.queryByLabelText("Đáp án")).not.toBeInTheDocument();
  expect(screen.getByText("serendipity")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Easy/ }));
  expect(onGrade).toHaveBeenCalledWith("easy");
});

test("keyboard 1–4 grades the flipped card", () => {
  const onGrade = vi.fn();
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={onGrade} />);

  fireEvent.keyDown(window, { key: "1" });
  expect(onGrade).toHaveBeenCalledWith("again");
});

test("pronounce button does not throw where speechSynthesis is absent", () => {
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={vi.fn()} />);
  expect(() => fireEvent.click(screen.getByRole("button", { name: "Phát âm" }))).not.toThrow();
});

test("grade buttons are disabled while submitting", () => {
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={vi.fn()} submitting />);
  expect(screen.getByRole("button", { name: /Good/ })).toBeDisabled();
});
