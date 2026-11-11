import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "../lessonsData";

vi.mock("../../../hooks/useLessonImages", () => ({
    useLessonImages: () => ({
        pages: [
            { url: "first.png", sourceIndex: 0 },
            { url: "second.png", sourceIndex: 1 },
        ],
        loading: false,
        thumbnail: "",
    }),
}));
vi.mock("../DrawingCanvas", () => ({ default: () => null }));

import LessonViewer from "../LessonViewer";

const lesson: Lesson = {
    id: "lesson", title: "Test", topic: "general",
    pages: [{ storagePath: "first.png" }, { storagePath: "second.png" }],
};

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("lesson timer customization", () => {
    it("keeps the color and note when switching slides and docking the timer", () => {
        render(<LessonViewer lesson={lesson} onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Timer color"), { target: { value: "#123456" } });
        fireEvent.change(screen.getByLabelText("Timer note"), { target: { value: "Review vocabulary" } });
        expect(screen.getByRole("form", { name: "Lesson timer" })).toHaveStyle({ backgroundColor: "#123456", color: "#ffffff" });

        fireEvent.keyDown(screen.getByLabelText("Timer note"), { key: " " });
        expect(screen.getByAltText("Page 1")).toBeInTheDocument();
        fireEvent.click(screen.getByTitle("Next page (→)"));
        expect(screen.getByLabelText("Timer note")).toHaveValue("Review vocabulary");

        fireEvent.click(screen.getByTitle("Pop out timer into a draggable, resizable window"));
        expect(screen.getByLabelText("Timer color")).toHaveValue("#123456");
        expect(screen.getByLabelText("Timer note")).toHaveValue("Review vocabulary");
        expect(screen.getByRole("form", { name: "Lesson timer" })).toHaveStyle({ backgroundColor: "#123456" });

        fireEvent.change(screen.getByLabelText("Timer color"), { target: { value: "#ffffff" } });
        fireEvent.change(screen.getByLabelText("Timer note"), { target: { value: "Practice" } });
        expect(screen.getByRole("form", { name: "Lesson timer" })).toHaveStyle({ backgroundColor: "#ffffff", color: "#111827" });
        fireEvent.click(screen.getAllByTitle("Dock timer back into the toolbar")[0]);
        expect(screen.getByLabelText("Timer color")).toHaveValue("#ffffff");
        expect(screen.getByLabelText("Timer note")).toHaveValue("Practice");
        expect(screen.getByLabelText("Timer note")).toHaveAttribute("maxlength", "80");
    });

    it("continues counting across views and preserves the chosen color and note after expiration", () => {
        vi.useFakeTimers();
        render(<LessonViewer lesson={lesson} onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Timer minutes"), { target: { value: "1" } });
        fireEvent.change(screen.getByLabelText("Timer color"), { target: { value: "#123456" } });
        fireEvent.change(screen.getByLabelText("Timer note"), { target: { value: "Finish" } });
        fireEvent.click(screen.getByTitle("Start timer"));
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(screen.getByText("0:50")).toBeInTheDocument();
        fireEvent.click(screen.getByTitle("Pop out timer into a draggable, resizable window"));
        act(() => { vi.advanceTimersByTime(50_000); });
        const timer = screen.getByRole("form", { name: "Lesson timer" });
        expect(within(timer).getByText("0:00")).toBeInTheDocument();
        expect(timer).toHaveClass("animate-pulse");
        expect(timer).toHaveStyle({ backgroundColor: "#123456" });
        fireEvent.click(within(timer).getByTitle("Stop timer"));
        expect(within(timer).getByText("Timer")).toBeInTheDocument();
        expect(screen.getByLabelText("Timer note")).toHaveValue("Finish");
        expect(screen.getByLabelText("Timer color")).toHaveValue("#123456");
    });

    it("retains the original yellow completion indicator for the default color", () => {
        vi.useFakeTimers();
        render(<LessonViewer lesson={lesson} onClose={vi.fn()} />);
        fireEvent.change(screen.getByLabelText("Timer minutes"), { target: { value: "1" } });
        fireEvent.click(screen.getByTitle("Start timer"));
        act(() => { vi.advanceTimersByTime(60_000); });
        expect(screen.getByRole("form", { name: "Lesson timer" })).toHaveStyle({ backgroundColor: "#facc15" });
    });

    it("wraps multiline notes and lets the popped-out box grow with the timer", () => {
        vi.stubGlobal("PointerEvent", MouseEvent);
        render(<LessonViewer lesson={lesson} onClose={vi.fn()} />);
        const dockedNote = screen.getByLabelText("Timer note");
        expect(dockedNote.tagName).toBe("TEXTAREA");
        expect(dockedNote).toHaveAttribute("wrap", "soft");
        Object.defineProperty(dockedNote, "scrollHeight", { configurable: true, value: 64 });
        fireEvent.change(dockedNote, { target: { value: "First line\nSecond line" } });
        expect(dockedNote).toHaveStyle({ height: "64px" });
        fireEvent.keyDown(dockedNote, { key: "ArrowRight" });
        expect(screen.getByAltText("Page 1")).toBeInTheDocument();

        fireEvent.click(screen.getByTitle("Pop out timer into a draggable, resizable window"));
        const floatingNote = screen.getByLabelText("Timer note");
        expect(floatingNote.tagName).toBe("TEXTAREA");
        expect(floatingNote).toHaveValue("First line\nSecond line");
        expect(floatingNote).toHaveAttribute("wrap", "soft");
        expect(floatingNote).toHaveClass("w-full", "flex-1", "overflow-y-auto");
        expect(floatingNote).not.toHaveClass("max-w-[180px]");
        const resizeHandle = screen.getByTitle("Drag to resize");
        resizeHandle.setPointerCapture = vi.fn();
        const timerWindow = resizeHandle.parentElement!;
        fireEvent.pointerDown(resizeHandle, { clientX: 100, clientY: 100 });
        fireEvent.pointerMove(resizeHandle, { clientX: 200, clientY: 160 });
        fireEvent.pointerUp(resizeHandle);
        expect(timerWindow).toHaveStyle({ width: "320px", height: "270px" });
        expect(floatingNote).toHaveClass("w-full", "flex-1");
        fireEvent.change(floatingNote, { target: { value: "A longer note\nwith multiple lines" } });
        fireEvent.keyDown(floatingNote, { key: " " });
        expect(screen.getByAltText("Page 1")).toBeInTheDocument();
        fireEvent.click(screen.getAllByTitle("Dock timer back into the toolbar")[0]);
        expect(screen.getByLabelText("Timer note")).toHaveValue("A longer note\nwith multiple lines");
    });
});
