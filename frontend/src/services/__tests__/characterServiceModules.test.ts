import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadString } from "firebase/storage";
import { addItemToCharacter, getUserAnimations, saveUserAnimations, uploadAnimationFrames } from "../characterService";
import { addItemToCharacter as addItemDirect } from "../characterSubcollections";
import { getUserAnimations as getAnimationsDirect } from "../characterAnimations";

vi.mock("../../firebase", () => ({ db: {}, storage: {} }));
vi.mock("firebase/firestore", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    addDoc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
  };
});
vi.mock("firebase/storage", async importOriginal => {
  const actual = await importOriginal<typeof import("firebase/storage")>();
  return { ...actual, ref: vi.fn((_storage, path) => ({ path })), uploadString: vi.fn(), getDownloadURL: vi.fn() };
});

beforeEach(() => vi.clearAllMocks());

describe("character service compatibility exports", () => {
  it("writes character subcollection items through the original export", async () => {
    expect(addItemToCharacter).toBe(addItemDirect);
    vi.mocked(addDoc).mockResolvedValue({ id: "item-id" } as Awaited<ReturnType<typeof addDoc>>);
    expect(await addItemToCharacter("uid", "hero", "notes", { text: "hello" })).toBe("item-id");
    expect(collection).toHaveBeenCalledWith(expect.anything(), "users", "uid", "characters", "hero", "notes");
    expect(addDoc).toHaveBeenCalledWith(expect.anything(), { text: "hello", createdAt: expect.any(Number) });
  });

  it("reads and writes user animation folders through the original exports", async () => {
    expect(getUserAnimations).toBe(getAnimationsDirect);
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true, data: () => ({ folders: ["one"] }),
    } as Awaited<ReturnType<typeof getDoc>>);
    expect(await getUserAnimations("uid")).toEqual({ folders: ["one"] });
    await saveUserAnimations("uid", { folders: ["one"] });
    expect(doc).toHaveBeenCalledWith(expect.anything(), "users", "uid", "animations", "root");
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), { folders: ["one"], updatedAt: expect.any(Number) }, { merge: true });
  });

  it("uploads animation frames to their original storage paths", async () => {
    vi.mocked(getDownloadURL).mockResolvedValue("thumbnail");
    const result = await uploadAnimationFrames("uid", "anim", ["frame-a", "frame-b"]);
    expect(result).toEqual({ storagePrefix: "users/uid/animations/anim/frames", framesCount: 2, thumbnailUrl: "thumbnail" });
    expect(ref).toHaveBeenCalledWith(expect.anything(), "users/uid/animations/anim/frames/frame_0.png");
    expect(ref).toHaveBeenCalledWith(expect.anything(), "users/uid/animations/anim/frames/frame_1.png");
    expect(uploadString).toHaveBeenNthCalledWith(1, { path: "users/uid/animations/anim/frames/frame_0.png" }, "frame-a", "data_url");
    expect(uploadString).toHaveBeenNthCalledWith(2, { path: "users/uid/animations/anim/frames/frame_1.png" }, "frame-b", "data_url");
  });
});
