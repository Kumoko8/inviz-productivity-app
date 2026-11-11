import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Lesson } from "../lessonsData";

const mocks = vi.hoisted(() => ({
    createLesson: vi.fn(),
    updateLesson: vi.fn(),
    loadLessons: vi.fn(),
    getDownloadURL: vi.fn(async (path: string) => `https://example.test/${path}`),
}));

vi.mock("../../../firebase", () => ({ storage: {} }));
vi.mock("firebase/storage", () => ({
    ref: (_storage: unknown, path: string) => path,
    getDownloadURL: mocks.getDownloadURL,
}));
vi.mock("../../../context/UserContext", () => ({ useUser: () => ({ user: { uid: "user1" } }) }));
vi.mock("../../../services/lessonService", () => ({
    createLesson: mocks.createLesson,
    updateLesson: mocks.updateLesson,
    loadLessons: mocks.loadLessons,
    deleteLesson: vi.fn(),
    saveLessonAnnotation: vi.fn(),
}));
vi.mock("../DrawingCanvas", () => ({ default: () => <div data-testid="drawing-canvas" /> }));
vi.mock("../PixelStudio", () => ({ default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>Close studio</button> }));

import CreateLessonForm from "../CreateLessonForm";
import LessonViewer from "../LessonViewer";
import LessonsMode from "../LessonsMode";

const topics = [{ id: "general", label: "General" }];
const lesson: Lesson = {
    id: "lesson", title: "Mixed", topic: "general",
    pages: [
        { storagePath: "first.png" },
        { storagePath: "movie.mp4", mediaType: "video", caption: "Watch this" },
        { storagePath: "hidden.mp4", mediaType: "video", hidden: true },
    ],
};

describe("lesson media", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createLesson.mockResolvedValue(undefined);
        mocks.updateLesson.mockResolvedValue(undefined);
        mocks.loadLessons.mockResolvedValue([]);
        vi.stubGlobal("URL", Object.assign(URL, {
            createObjectURL: vi.fn(() => "blob:preview"),
            revokeObjectURL: vi.fn(),
        }));
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

    it("adds image and video pages and sends both to the create flow", async () => {
        const { container } = render(<CreateLessonForm existingTopics={topics} onCreated={vi.fn()} onCancel={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText("e.g. Similes"), { target: { value: "Mixed" } });
        const input = container.querySelector('input[type="file"]')!;
        expect(input).toHaveAttribute("accept", "image/*,video/*");
        const image = new File(["image"], "first.png", { type: "image/png" });
        const video = new File(["video"], "movie.mp4", { type: "video/mp4" });
        fireEvent.change(input, { target: { files: [image, video] } });
        expect(screen.getByText(/movie.mp4/)).toBeInTheDocument();
        expect(screen.getByLabelText("Video page")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("Hide slide 2"));
        fireEvent.click(screen.getByText("Create Lesson", { selector: "button" }));
        await waitFor(() => expect(mocks.createLesson).toHaveBeenCalled());
        expect(mocks.createLesson.mock.calls[0][1]).toMatchObject({ files: [image, video], hidden: [false, true] });
    });

    it("keeps an existing video type while editing", async () => {
        render(<CreateLessonForm existingTopics={topics} lesson={lesson} onCreated={vi.fn()} onCancel={vi.fn()} />);
        expect(screen.getAllByLabelText("Video page")).toHaveLength(2);
        fireEvent.click(screen.getByText("Save Changes"));
        await waitFor(() => expect(mocks.updateLesson).toHaveBeenCalled());
        expect(mocks.updateLesson.mock.calls[0][2].pages[1]).toMatchObject({ storagePath: "movie.mp4", mediaType: "video" });
    });

    it("reports unsupported files instead of silently adding them", () => {
        const { container } = render(<CreateLessonForm existingTopics={topics} onCreated={vi.fn()} onCancel={vi.fn()} />);
        fireEvent.change(container.querySelector('input[type="file"]')!, {
            target: { files: [new File(["data"], "document.pdf", { type: "application/pdf" })] },
        });
        expect(screen.getByText("Only image and video files can be added.")).toBeInTheDocument();
        expect(screen.getByText("Pages (0)")).toBeInTheDocument();
    });

    it("shows a video placeholder rather than an image for a video-first lesson card", async () => {
        mocks.loadLessons.mockResolvedValue([{
            ...lesson, pages: [{ storagePath: "movie.mp4", mediaType: "video" }],
        }]);
        render(<LessonsMode onClose={vi.fn()} />);
        expect(await screen.findByText("▶ Video lesson")).toBeInTheDocument();
        expect(screen.queryByAltText("Mixed")).not.toBeInTheDocument();
        expect(mocks.getDownloadURL).not.toHaveBeenCalled();
    });

    it("opens and closes Pixel Studio from the lessons library", async () => {
        render(<LessonsMode onClose={vi.fn()} />);
        fireEvent.click(screen.getByText("Pixel Studio"));
        expect(screen.getByText("Close studio")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Close studio"));
        expect(screen.queryByText("Close studio")).not.toBeInTheDocument();
    });

    it("presents a video with manual controls and preserves image navigation", async () => {
        const { container } = render(<LessonViewer lesson={lesson} onClose={vi.fn()} />);
        const image = await screen.findByAltText("Page 1");
        expect(image).toHaveAttribute("src", "https://example.test/first.png");
        fireEvent.load(image);
        expect(screen.getByTestId("drawing-canvas")).toBeInTheDocument();
        fireEvent.click(screen.getByTitle("Next page (→)"));
        const video = screen.getByLabelText("Watch this") as HTMLVideoElement;
        expect(video).toHaveAttribute("src", "https://example.test/movie.mp4");
        expect(video.controls).toBe(true);
        expect(video.autoplay).toBe(false);
        expect(video.loop).toBe(false);
        expect(screen.queryByTestId("drawing-canvas")).not.toBeInTheDocument();
        expect(screen.queryByTitle("Toggle highlight drawing")).not.toBeInTheDocument();
        fireEvent.keyDown(video, { key: " " });
        fireEvent.keyDown(video, { key: "ArrowLeft" });
        expect(container.querySelector("video")).toBe(video);
        fireEvent.error(video);
        expect(screen.getByRole("alert")).toHaveTextContent("Could not load this video");
        fireEvent.click(screen.getByTitle("Previous page (←)"));
        expect(screen.getByAltText("Page 1")).toBeInTheDocument();
    });
});
