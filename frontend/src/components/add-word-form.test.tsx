import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { AddWordForm } from "./add-word-form";

test("submit is disabled while the input is empty", () => {
  render(<AddWordForm onSubmit={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Thêm từ" });
  expect(button).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Từ mới"), { target: { value: "hello" } });
  expect(button).toBeEnabled();
});

test("submits the trimmed word and clears the input on success", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<AddWordForm onSubmit={onSubmit} />);

  const input = screen.getByLabelText("Từ mới");
  fireEvent.change(input, { target: { value: "  Hello  " } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm từ" }));

  expect(onSubmit).toHaveBeenCalledWith("Hello");
  await waitFor(() => expect(input).toHaveValue(""));
});

test("keeps the input and shows the error message on failure", async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error("conflict"));
  render(<AddWordForm onSubmit={onSubmit} errorMessage="Từ này đã có trong deck." />);

  const input = screen.getByLabelText("Từ mới");
  fireEvent.change(input, { target: { value: "hello" } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm từ" }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  expect(input).toHaveValue("hello");
  expect(screen.getByRole("alert")).toHaveTextContent("Từ này đã có trong deck.");
});
