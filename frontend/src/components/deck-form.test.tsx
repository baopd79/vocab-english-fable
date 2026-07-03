import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DeckForm } from "./deck-form";

test("submits trimmed name and description", () => {
  const onSubmit = vi.fn();
  render(<DeckForm submitLabel="Tạo" onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText("Tên deck"), { target: { value: "  IELTS  " } });
  fireEvent.change(screen.getByLabelText("Mô tả"), { target: { value: "band 7" } });
  fireEvent.click(screen.getByRole("button", { name: "Tạo" }));

  expect(onSubmit).toHaveBeenCalledWith({ name: "IELTS", description: "band 7" });
});

test("submit is disabled until a name is entered", () => {
  render(<DeckForm submitLabel="Tạo" onSubmit={vi.fn()} />);
  const submit = screen.getByRole("button", { name: "Tạo" });

  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tên deck"), { target: { value: "Travel" } });
  expect(submit).toBeEnabled();
});

test("prefills fields in edit mode and shows an error message", () => {
  render(
    <DeckForm
      submitLabel="Lưu"
      initial={{ name: "Old", description: "desc" }}
      errorMessage="Tên deck đã tồn tại."
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("Tên deck")).toHaveValue("Old");
  expect(screen.getByRole("alert")).toHaveTextContent("Tên deck đã tồn tại.");
});
