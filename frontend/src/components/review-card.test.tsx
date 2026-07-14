import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { speak } from "@/lib/tts";
import type { UserWord } from "@/lib/words";

import { ReviewCard } from "./review-card";

// TTS is a no-op in jsdom; mock it so listening-mode tests can assert calls.
vi.mock("@/lib/tts", () => ({
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  canSpeak: () => true,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

test("pronounce button speaks the word", () => {
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Phát âm" }));
  expect(speak).toHaveBeenCalledWith("serendipity");
});

test("grade buttons are disabled while submitting", () => {
  render(<ReviewCard card={card({ first_reviewed_at: null })} onGrade={vi.fn()} submitting />);
  expect(screen.getByRole("button", { name: /Good/ })).toBeDisabled();
});

// --- review modes (SPEC §17.2-10) --------------------------------------------

const MCQ_CHOICES = ["nghĩa A", "sự tình cờ may mắn", "nghĩa B", "nghĩa C"];

function mcqCard() {
  return card({ review_mode: "mcq", mcq_choices: MCQ_CHOICES });
}

test("mcq: shows the word and 4 choices; the right pick flips with praise", () => {
  const onGrade = vi.fn();
  render(<ReviewCard card={mcqCard()} onGrade={onGrade} />);

  // Question face: the word is up, no typing input, all 4 meanings offered.
  expect(screen.getByText("serendipity")).toBeInTheDocument();
  expect(screen.queryByLabelText("Đáp án")).not.toBeInTheDocument();
  for (const choice of MCQ_CHOICES) {
    expect(screen.getByRole("button", { name: new RegExp(choice) })).toBeInTheDocument();
  }

  fireEvent.click(screen.getByRole("button", { name: /sự tình cờ may mắn/ }));

  expect(screen.getByText("Chính xác!")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Good/ }));
  expect(onGrade).toHaveBeenCalledWith("good");
});

test("mcq: a wrong pick flips showing the picked answer and the Again hint", () => {
  render(<ReviewCard card={mcqCard()} onGrade={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: /nghĩa B/ }));

  expect(screen.getByText(/Bạn chọn “nghĩa B” — chưa đúng/)).toBeInTheDocument();
  expect(screen.getByText("Again", { selector: "strong" })).toBeInTheDocument();
});

test("mcq: keys 1–4 pick a choice and the digit is consumed", () => {
  render(<ReviewCard card={mcqCard()} onGrade={vi.fn()} />);

  // false = preventDefault fired — the digit must not leak anywhere else.
  expect(fireEvent.keyDown(window, { key: "3" })).toBe(false);

  expect(screen.getByText(/Bạn chọn “nghĩa B”/)).toBeInTheDocument();
});

test("mcq without choices falls back to the classic typing front", () => {
  render(<ReviewCard card={card({ review_mode: "mcq", mcq_choices: null })} onGrade={vi.fn()} />);
  expect(screen.getByLabelText("Đáp án")).toBeInTheDocument();
});

test("listening: hides the word, auto-plays it, and checks the typed answer", async () => {
  const onGrade = vi.fn();
  render(<ReviewCard card={card({ review_mode: "listening" })} onGrade={onGrade} />);

  // The word plays shortly after mount (§17.3-Q1: auto + replay) but never shows.
  await waitFor(() => expect(speak).toHaveBeenCalledWith("serendipity"));
  expect(screen.queryByText("serendipity")).not.toBeInTheDocument();
  expect(screen.queryByText("sự tình cờ may mắn")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Nghe lại" })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Đáp án"), { target: { value: "serendipity" } });
  fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));

  expect(screen.getByText("Chính xác!")).toBeInTheDocument();
  expect(screen.getByText("serendipity")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Easy/ }));
  expect(onGrade).toHaveBeenCalledWith("easy");
});

test("cram ignores review_mode and keeps the classic typing front", () => {
  render(<ReviewCard mode="cram" card={mcqCard()} onGrade={vi.fn()} />);
  expect(screen.getByLabelText("Đáp án")).toBeInTheDocument();
});
