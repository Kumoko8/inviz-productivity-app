import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDoc, getDocs } from "firebase/firestore";
import { getUserCharacter, getUserCharacters } from "../characterService";

vi.mock("../../firebase", () => ({ db: {}, storage: {} }));
vi.mock("firebase/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return { ...actual, collection: vi.fn(() => ({})), doc: vi.fn(() => ({})), getDocs: vi.fn(), getDoc: vi.fn() };
});

const base = {
  name: "Hero",
  transformThresholds: [7],
  transformAnimations: ["form"],
  transformTempAnimations: ["transition"],
  actionAnimations: ["action"],
  damageAnimations: ["damage"],
  defeatAnimations: ["defeat"],
  woundedAnimations: ["wounded"],
};
const user = { name: "Hero", actionAnimations: [], transformThresholds: [9] };
const snapshot = (id: string, data: object) => ({ id, data: () => data });

beforeEach(() => vi.clearAllMocks());

describe("character fallback reads", () => {
  it("preserves overrides and fills missing fields for list and single reads", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [snapshot("custom", user)],
    } as Awaited<ReturnType<typeof getDocs>>);
    const list = await getUserCharacters("uid", [{ ...base, id: "base" }]);
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true, data: () => user,
    } as Awaited<ReturnType<typeof getDoc>>);
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [snapshot("base", base)],
    } as Awaited<ReturnType<typeof getDocs>>);
    const single = await getUserCharacter("uid", "custom");
    const expected = { ...base, ...user, id: "custom" };
    expect(list.custom).toEqual(expected);
    expect(single).toEqual(expected);
  });

  it("leaves a custom character unchanged when no base matches", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [snapshot("custom", user)],
    } as Awaited<ReturnType<typeof getDocs>>);
    expect(await getUserCharacters("uid", [])).toEqual({ custom: { ...user, id: "custom" } });
  });
});
