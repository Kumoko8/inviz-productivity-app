import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "../../components/lessons/lessonsData";

const mocks = vi.hoisted(() => ({
    uploadBytes: vi.fn(),
    deleteObject: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
}));

vi.mock("../../firebase", () => ({ db: {}, storage: {} }));
vi.mock("firebase/storage", () => ({
    ref: (_storage: unknown, path: string) => path,
    uploadBytes: mocks.uploadBytes,
    deleteObject: mocks.deleteObject,
}));
vi.mock("firebase/firestore", () => ({
    collection: (...segments: unknown[]) => segments,
    doc: (...segments: unknown[]) => segments,
    addDoc: mocks.addDoc,
    updateDoc: mocks.updateDoc,
    deleteDoc: mocks.deleteDoc,
    deleteField: () => "deleted",
    serverTimestamp: () => "timestamp",
    getDocs: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
}));

import { createLesson, deleteLesson, updateLesson } from "../lessonService";

describe("lesson media storage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.uploadBytes.mockResolvedValue({});
        mocks.deleteObject.mockResolvedValue(undefined);
        mocks.addDoc.mockResolvedValue({});
        mocks.updateDoc.mockResolvedValue(undefined);
        mocks.deleteDoc.mockResolvedValue(undefined);
    });

    it("uploads mixed pages to user storage and records video type and hidden state", async () => {
        const image = new File(["image"], "image.png", { type: "image/png" });
        const video = new File(["video"], "movie.mp4", { type: "video/mp4" });
        const progress = vi.fn();

        await createLesson("user1", {
            title: "Test", topic: "general", captions: ["Picture", "Clip"],
            files: [image, video], hidden: [false, true],
        }, progress);

        expect(mocks.uploadBytes).toHaveBeenCalledTimes(2);
        expect(mocks.uploadBytes.mock.calls[0][0]).toMatch(/^users\/user1\/lessons\/general\/test\/01_.*\.png$/);
        expect(mocks.uploadBytes.mock.calls[1][0]).toMatch(/^users\/user1\/lessons\/general\/test\/02_.*\.mp4$/);
        expect(mocks.uploadBytes.mock.calls[1][1]).toBe(video);
        const data = mocks.addDoc.mock.calls[0][1];
        expect(data.pages[0]).toEqual({ storagePath: mocks.uploadBytes.mock.calls[0][0], caption: "Picture" });
        expect(data.pages[1]).toEqual({ storagePath: mocks.uploadBytes.mock.calls[1][0], caption: "Clip", mediaType: "video", hidden: true });
        expect(progress.mock.calls).toEqual([[{ uploaded: 1, total: 2 }], [{ uploaded: 2, total: 2 }]]);
    });

    it("preserves video type when editing, uploads replacements and deletes removed files", async () => {
        const lesson: Lesson = {
            id: "lesson", title: "Test", topic: "general",
            pages: [{ storagePath: "video.mp4", mediaType: "video" }, { storagePath: "old.png", annotationPath: "ink.png" }],
        };
        const image = new File(["new"], "new.png", { type: "image/png" });
        await updateLesson("user1", lesson, {
            title: "Test", topic: "general",
            pages: [{ storagePath: "video.mp4", mediaType: "video", caption: "Clip" }, { storagePath: "old.png", file: image }],
        });

        const pages = mocks.updateDoc.mock.calls[0][1].pages;
        expect(pages[0]).toEqual({ storagePath: "video.mp4", mediaType: "video", caption: "Clip" });
        expect(pages[1]).toEqual({ storagePath: mocks.uploadBytes.mock.calls[0][0] });
        expect(mocks.deleteObject).toHaveBeenCalledWith("old.png");
        expect(mocks.deleteObject).toHaveBeenCalledWith("ink.png");
        expect(mocks.deleteObject).not.toHaveBeenCalledWith("video.mp4");
    });

    it("deletes video files when deleting a lesson", async () => {
        await deleteLesson("user1", {
            id: "lesson", title: "Test", topic: "general",
            pages: [{ storagePath: "video.mp4", mediaType: "video" }],
        });
        expect(mocks.deleteObject).toHaveBeenCalledWith("video.mp4");
    });

    it("stores the type of newly added videos when editing", async () => {
        const lesson: Lesson = {
            id: "lesson", title: "Test", topic: "general", pages: [{ storagePath: "image.png" }],
        };
        const video = new File(["video"], "movie.webm", { type: "video/webm" });
        await updateLesson("user1", lesson, {
            title: "Test", topic: "general", pages: [{ storagePath: "image.png" }, { file: video }],
        });
        expect(mocks.updateDoc.mock.calls[0][1].pages[1]).toEqual({
            storagePath: mocks.uploadBytes.mock.calls[0][0], mediaType: "video",
        });
    });

    it("does not save lesson metadata when a video upload fails", async () => {
        mocks.uploadBytes.mockRejectedValueOnce(new Error("Upload failed"));
        await expect(createLesson("user1", {
            title: "Test", topic: "general", captions: [],
            files: [new File(["video"], "movie.mp4", { type: "video/mp4" })],
        })).rejects.toThrow("Upload failed");
        expect(mocks.addDoc).not.toHaveBeenCalled();
    });
});
