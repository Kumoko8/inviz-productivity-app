import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminCharacterFieldEditor from "../AdminCharacterFieldEditor";
import { readCharacterFields, writeCharacterField } from "../../services/adminCharacterFields";

vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("../../services/adminCharacterFields", async importOriginal => {
  const actual = await importOriginal<typeof import("../../services/adminCharacterFields")>();
  return { ...actual, readCharacterFields: vi.fn(), writeCharacterField: vi.fn() };
});

const target = { kind: "custom" as const, uid: "admin", id: "custom-1" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readCharacterFields).mockResolvedValue({
    transformThresholds: [7, 12],
    actionAnimations: ["first.mp4", "", "third.mp4"],
    settings: { enabled: true },
    createdAt: new Timestamp(10, 0),
  });
  vi.mocked(writeCharacterField).mockResolvedValue();
});

describe("AdminCharacterFieldEditor", () => {
  it("edits indexed animation paths without changing other fields", async () => {
    const onSaved = vi.fn();
    render(<AdminCharacterFieldEditor target={target} previewValues={{}} onSaved={onSaved} />);
    const select = await screen.findByLabelText("Field");
    fireEvent.change(select, { target: { value: "actionAnimations" } });
    expect(screen.getByLabelText("2")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("2"), { target: { value: "second.mp4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));

    await waitFor(() => expect(writeCharacterField).toHaveBeenCalledWith(target, "actionAnimations", ["first.mp4", "second.mp4", "third.mp4"]));
    expect(onSaved).toHaveBeenCalledWith(target, "actionAnimations", ["first.mp4", "second.mp4", "third.mp4"]);
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("validates thresholds and allows an arbitrary JSON field", async () => {
    render(<AdminCharacterFieldEditor target={target} previewValues={{}} onSaved={vi.fn()} />);
    await screen.findByLabelText("Field");
    fireEvent.change(screen.getByLabelText("1"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));
    expect(screen.getByRole("alert")).toHaveTextContent("positive whole numbers");
    expect(writeCharacterField).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Field"), { target: { value: "settings" } });
    fireEvent.change(screen.getByLabelText("JSON value"), { target: { value: '{"enabled":false}' } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));
    await waitFor(() => expect(writeCharacterField).toHaveBeenCalledWith(target, "settings", { enabled: false }));
  });

  it("shows Firestore-specific values without allowing writes", async () => {
    render(<AdminCharacterFieldEditor target={target} previewValues={{}} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Field"), { target: { value: "createdAt" } });
    expect(screen.getByText(/read-only here/)).toBeInTheDocument();
    expect(screen.getByText(/"seconds": 10/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save field" })).toBeDisabled();
  });

  it("reports failed writes and keeps the unsaved value", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(writeCharacterField).mockRejectedValueOnce(new Error("offline"));
    render(<AdminCharacterFieldEditor target={target} previewValues={{}} onSaved={vi.fn()} />);
    await screen.findByLabelText("Field");
    fireEvent.change(screen.getByLabelText("1"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(screen.getByLabelText("1")).toHaveValue(8);
  });

  it("adds a field with a literal dotted name", async () => {
    render(<AdminCharacterFieldEditor target={target} previewValues={{}} onSaved={vi.fn()} />);
    await screen.findByLabelText("Field");
    fireEvent.change(screen.getByLabelText("Add a field"), { target: { value: "extra.note" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit new field" }));
    fireEvent.change(screen.getByLabelText("JSON value"), { target: { value: '"hello"' } });
    fireEvent.click(screen.getByRole("button", { name: "Save field" }));
    await waitFor(() => expect(writeCharacterField).toHaveBeenCalledWith(target, "extra.note", "hello"));
  });

  it("can copy inherited preview values into a missing field without saving automatically", async () => {
    render(<AdminCharacterFieldEditor target={target} previewValues={{ woundedAnimations: ["inherited.mp4", ""] }} onSaved={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Field"), { target: { value: "woundedAnimations" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy preview values" }));
    expect(screen.getByLabelText("1")).toHaveValue("inherited.mp4");
    expect(screen.getByLabelText("2")).toHaveValue("");
    expect(writeCharacterField).not.toHaveBeenCalled();
  });
});
