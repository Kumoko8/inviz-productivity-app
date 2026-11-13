import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDoc, getDocs } from "firebase/firestore";
import { getCharacters, getUserCharacter, getUserCharacters } from "../characterService";

vi.mock("../../firebase", () => ({ db: {}, storage: {} }));
vi.mock("firebase/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return { ...actual, collection: vi.fn(() => ({})), doc: vi.fn(() => ({})), getDocs: vi.fn(), getDoc: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

describe("character document identity", () => {
  it("uses document IDs instead of an editable id field for base and user lists", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: "document-id", data: () => ({ id: "field-value" }) }],
    } as Awaited<ReturnType<typeof getDocs>>);

    expect(await getCharacters()).toEqual([{ id: "document-id" }]);
    expect(await getUserCharacters("admin")).toEqual({ "document-id": { id: "document-id" } });
  });

  it("uses the document ID when fetching a single user character", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ id: "field-value" }),
    } as Awaited<ReturnType<typeof getDoc>>);
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as Awaited<ReturnType<typeof getDocs>>);

    expect(await getUserCharacter("admin", "document-id")).toEqual({ id: "document-id" });
  });
});
