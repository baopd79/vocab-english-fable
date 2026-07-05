import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

test("clicking flips data-theme on <html> and persists it", () => {
  document.documentElement.dataset.theme = "light";
  render(<ThemeToggle />);

  fireEvent.click(screen.getByRole("button", { name: "Đổi giao diện sáng/tối" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("theme")).toBe("dark");

  fireEvent.click(screen.getByRole("button", { name: "Đổi giao diện sáng/tối" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("theme")).toBe("light");
});
