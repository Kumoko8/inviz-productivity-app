import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CharacterGallery from "../CharacterGallery";

vi.mock("../../services/characterService", () => ({
  getCharacters: vi.fn(async () => [{ id: "base-1", name: "Hero" }]),
}));
vi.mock("../../hooks/usePreviewLoader", () => ({ default: () => ({ urls: {} }) }));
vi.mock("../GalleryTile", () => ({ default: ({ name }: { name: string }) => <div>{name}</div> }));
vi.mock("../AdminCharacterFieldEditor", () => ({
  default: ({ target }: { target: { kind: string; id: string; uid?: string } }) =>
    <div>Editing {target.kind} {target.id} {target.uid}</div>,
}));

const userCharacters = {
  "base-1": { id: "base-1", name: "Hero" },
  "custom-1": { id: "custom-1", name: "Hero", playerName: "Player" },
};

describe("CharacterGallery admin preview", () => {
  it("only shows the editor to admins and distinguishes base and custom documents", async () => {
    const { rerender } = render(<CharacterGallery isAdmin={false} uid="admin" userCharacters={userCharacters} onCharacterFieldSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /show gallery/i }));
    await screen.findByText("Hero");
    expect(screen.queryByText("Animation Preview (admin)")).not.toBeInTheDocument();

    rerender(<CharacterGallery isAdmin uid="admin" userCharacters={userCharacters} onCharacterFieldSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hero (base)" }));
    expect(screen.getByText("Editing base base-1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Player (custom)" }));
    expect(screen.getByText("Editing custom custom-1 admin")).toBeInTheDocument();
    expect(screen.queryByText("Editing base base-1")).not.toBeInTheDocument();
  });
});
