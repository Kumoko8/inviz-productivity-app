import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldPath, doc, getDoc, updateDoc } from "firebase/firestore";
import { readCharacterFields, writeCharacterField } from "../adminCharacterFields";

vi.mock("../../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return { ...actual, doc: vi.fn(), getDoc: vi.fn(), updateDoc: vi.fn() };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(doc).mockReturnValue({} as ReturnType<typeof doc>);
});

describe("admin character field persistence", () => {
  it("reads a base document and writes only the selected literal field", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => ({ xp: 2 }) } as Awaited<ReturnType<typeof getDoc>>);
    const target = { kind: "base" as const, id: "base-1" };
    expect(await readCharacterFields(target)).toEqual({ xp: 2 });
    await writeCharacterField(target, "a.b", [1, 2]);
    expect(doc).toHaveBeenCalledWith(expect.anything(), "characters", "base-1");
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), new FieldPath("a.b"), [1, 2]);
  });

  it("uses the signed-in user's custom character path and rejects missing documents", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as Awaited<ReturnType<typeof getDoc>>);
    const target = { kind: "custom" as const, uid: "admin", id: "custom-1" };
    await expect(readCharacterFields(target)).rejects.toThrow("no longer exists");
    expect(doc).toHaveBeenCalledWith(expect.anything(), "users", "admin", "characters", "custom-1");
  });
});
