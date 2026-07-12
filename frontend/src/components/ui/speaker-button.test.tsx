import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { speak } from "@/lib/tts";

import { SpeakerButton } from "./speaker-button";

vi.mock("@/lib/tts", () => ({ speak: vi.fn() }));

beforeEach(() => {
  vi.mocked(speak).mockClear();
});

test("clicking pronounces the text", () => {
  render(<SpeakerButton text="humble" />);

  fireEvent.click(screen.getByRole("button", { name: "Phát âm" }));

  expect(speak).toHaveBeenCalledWith("humble");
});

test("the click stays local: no bubbling to parents, no form submit", () => {
  // SPEC §17.1-B1/B2 — speaker buttons live inside clickable cards and forms;
  // pronouncing must never navigate or submit.
  const onParentClick = vi.fn();
  const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
  render(
    <form onSubmit={onSubmit}>
      <div onClick={onParentClick}>
        <SpeakerButton text="humble" />
      </div>
    </form>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Phát âm" }));

  expect(speak).toHaveBeenCalledWith("humble");
  expect(onParentClick).not.toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
});

test("is disabled without text to speak", () => {
  render(<SpeakerButton text="" disabled />);

  const button = screen.getByRole("button", { name: "Phát âm" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(speak).not.toHaveBeenCalled();
});
