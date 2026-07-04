import { expect, test } from "vitest";

import { isTypingCorrect, normalizeWord } from "./normalize";

test("normalizeWord trims, lowercases and collapses whitespace", () => {
  expect(normalizeWord("  Hello ")).toBe("hello");
  expect(normalizeWord("ICE   CREAM")).toBe("ice cream");
  expect(normalizeWord("Well-Being")).toBe("well-being");
});

test("isTypingCorrect ignores case and surrounding space", () => {
  expect(isTypingCorrect("  Serendipity ", "serendipity")).toBe(true);
  expect(isTypingCorrect("ICE cream", "ice cream")).toBe(true);
});

test("isTypingCorrect is exact, not fuzzy", () => {
  expect(isTypingCorrect("serendipty", "serendipity")).toBe(false);
  expect(isTypingCorrect("", "hello")).toBe(false);
});
