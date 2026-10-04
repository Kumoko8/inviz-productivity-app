import React, { useState, useCallback, useEffect, useRef } from "react";
import { Lesson } from "./lessonsData";
import DrawingCanvas, { DrawTool } from "./DrawingCanvas";
import { useLessonImages } from "../../hooks/useLessonImages";

interface Props {
    lesson: Lesson;
    onClose: () => void;
}

const HIGHLIGHT_COLORS = [
    { label: "Yellow", value: "#facc15" },
    { label: "Cyan",   value: "#22d3ee" },
    { label: "Rose",   value: "#fb7185" },
    { label: "Lime",   value: "#a3e635" },
    { label: "White",  value: "#f8fafc" },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

// Native image dimensions used as the SVG viewBox for DrawingCanvas.
// 1600×1200 matches a typical landscape slide; portrait images still display
// correctly because the container uses object-fit: contain.
const CANVAS_W = 1600;
const CANVAS_H = 1200;

const LessonViewer: React.FC<Props> = ({ lesson, onClose }) => {
    const [pageIndex, setPageIndex] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [drawColor, setDrawColor] = useState(HIGHLIGHT_COLORS[0].value);
    const [drawingEnabled, setDrawingEnabled] = useState(false);
    const [drawTool, setDrawTool] = useState<DrawTool>("highlight");
    const [canvasKey, setCanvasKey] = useState<Record<number, number>>({});
    const [canvasUndoVersion, setCanvasUndoVersion] = useState<Record<number, number>>({});
    const [timerMinutes, setTimerMinutes] = useState("5");
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerPoppedOut, setTimerPoppedOut] = useState(false);
    const [floatPos, setFloatPos] = useState(() => ({
        x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - 260) : 20,
        y: 90,
    }));
    const [floatSize, setFloatSize] = useState({ width: 220, height: 160 });
    const floatDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
    const floatResizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);
    // Pan state
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panOffsetRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef<{ clientX: number; clientY: number; ox: number; oy: number } | null>(null);
    const timerEndsAtRef = useRef<number | null>(null);
    // Tracks whether the current page's <img> has laid out (has real dimensions),
    // so the drawing canvas isn't mounted on top of a still-collapsed (0×0) wrapper.
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const { pages, loading } = useLessonImages(lesson);
    const totalPages = pages.length;
    const current = pages[pageIndex];

    const resetView = useCallback(() => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
    }, []);

    // Reset view + drawing when the lesson changes
    useEffect(() => {
        setPageIndex(0);
        resetView();
        setCanvasKey({});
        setCanvasUndoVersion({});
        setTimerRunning(false);
        setSecondsRemaining(null);
        timerEndsAtRef.current = null;
    }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reset the load gate whenever the page image changes, then re-check
    // immediately in case the image is already cached (onLoad may not fire).
    useEffect(() => {
        setImageLoaded(false);
        if (imgRef.current?.complete) setImageLoaded(true);
    }, [current?.url]);

    useEffect(() => {
        if (!timerRunning || timerEndsAtRef.current === null) return;

        const tick = () => {
            const remaining = Math.max(0, Math.ceil((timerEndsAtRef.current! - Date.now()) / 1000));
            setSecondsRemaining(remaining);
            if (remaining === 0) setTimerRunning(false);
        };
        tick();
        const intervalId = window.setInterval(tick, 250);
        return () => window.clearInterval(intervalId);
    }, [timerRunning]);

    const goNext = useCallback(() => {
        setPageIndex((p) => Math.min(p + 1, totalPages - 1));
        resetView();
    }, [totalPages, resetView]);

    const goPrev = useCallback(() => {
        setPageIndex((p) => Math.max(p - 1, 0));
        resetView();
    }, [resetView]);

    // Pan pointer handlers — active only when drawing is disabled
    const onPanDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (drawingEnabled || e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsPanning(true);
            panStartRef.current = {
                clientX: e.clientX,
                clientY: e.clientY,
                ox: panOffsetRef.current.x,
                oy: panOffsetRef.current.y,
            };
        },
        [drawingEnabled]
    );

    const onPanMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!panStartRef.current || drawingEnabled) return;
            const dx = e.clientX - panStartRef.current.clientX;
            const dy = e.clientY - panStartRef.current.clientY;
            const next = { x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy };
            panOffsetRef.current = next;
            setPanOffset(next);
        },
        [drawingEnabled]
    );

    const onPanUp = useCallback(() => {
        panStartRef.current = null;
        setIsPanning(false);
    }, []);

    // Drag handlers for the popped-out timer window's header
    const onFloatDragDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        floatDragRef.current = { startX: e.clientX, startY: e.clientY, posX: floatPos.x, posY: floatPos.y };
    }, [floatPos]);

    const onFloatDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!floatDragRef.current) return;
        const dx = e.clientX - floatDragRef.current.startX;
        const dy = e.clientY - floatDragRef.current.startY;
        setFloatPos({ x: floatDragRef.current.posX + dx, y: floatDragRef.current.posY + dy });
    }, []);

    const onFloatDragUp = useCallback(() => {
        floatDragRef.current = null;
    }, []);

    // Resize handlers for the popped-out timer window's corner grip
    const onFloatResizeDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        floatResizeRef.current = { startX: e.clientX, startY: e.clientY, width: floatSize.width, height: floatSize.height };
    }, [floatSize]);

    const onFloatResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!floatResizeRef.current) return;
        const dx = e.clientX - floatResizeRef.current.startX;
        const dy = e.clientY - floatResizeRef.current.startY;
        setFloatSize({
            width: Math.max(180, floatResizeRef.current.width + dx),
            height: Math.max(120, floatResizeRef.current.height + dy),
        });
    }, []);

    const onFloatResizeUp = useCallback(() => {
        floatResizeRef.current = null;
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === "ArrowRight" || e.key === " ") goNext();
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "+") setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
            if (e.key === "-") setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [goNext, goPrev]);

    // Reset pan when zoom is reset to 1 via the % button
    const handleZoomReset = useCallback(() => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        panOffsetRef.current = { x: 0, y: 0 };
    }, []);

    const clearPageDrawing = () =>
        setCanvasKey((prev) => ({ ...prev, [pageIndex]: (prev[pageIndex] ?? 0) + 1 }));

    const undoPageDrawing = () =>
        setCanvasUndoVersion((prev) => ({ ...prev, [pageIndex]: (prev[pageIndex] ?? 0) + 1 }));

    const startTimer = () => {
        const minutes = Number(timerMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        const duration = Math.ceil(minutes * 60);
        timerEndsAtRef.current = Date.now() + duration * 1000;
        setSecondsRemaining(duration);
        setTimerRunning(true);
    };

    // Dismiss the expired/flashing state and return the timer to its original state.
    const resetTimer = () => {
        setTimerRunning(false);
        setSecondsRemaining(null);
        timerEndsAtRef.current = null;
    };

    const formatTimer = (seconds: number | null) => {
        if (seconds === null) return "Timer";
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        return `${minutes}:${remainder.toString().padStart(2, "0")}`;
    };

    return (
        <div className="fixed inset-0 z-[70] bg-gray-950 flex flex-col select-none">
            {/* ── Top toolbar ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap gap-y-2">
                {/* Left: title + page counter */}
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onClose}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium"
                    >
                        ← Back
                    </button>
                    <span className="text-white font-semibold truncate max-w-[200px] text-sm">{lesson.title}</span>
                    <span className="text-gray-400 text-xs whitespace-nowrap">
                        {pageIndex + 1} / {totalPages}
                    </span>
                </div>

                {/* Center: zoom controls */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM))}
                        disabled={zoom <= MIN_ZOOM}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm disabled:opacity-40"
                        title="Zoom out (−)"
                    >−</button>
                    <button
                        onClick={handleZoomReset}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-mono min-w-[52px] text-center"
                        title="Reset zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        onClick={() => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM))}
                        disabled={zoom >= MAX_ZOOM}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm disabled:opacity-40"
                        title="Zoom in (+)"
                    >+</button>
                </div>

                {!timerPoppedOut ? (
                    <form onSubmit={(event) => { event.preventDefault(); secondsRemaining === 0 ? resetTimer() : startTimer(); }} className={`flex items-center gap-1 rounded px-1 py-0.5 ${secondsRemaining === 0 ? "bg-yellow-400 animate-pulse" : "bg-gray-800"}`}>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={timerMinutes}
                            onChange={(event) => setTimerMinutes(event.target.value)}
                            className="w-14 bg-transparent text-center text-sm text-white outline-none"
                            placeholder="Min"
                            aria-label="Timer minutes"
                        />
                        <span className={`min-w-[42px] text-center text-xs font-mono ${secondsRemaining === 0 ? "text-gray-950" : "text-white"}`}>
                            {formatTimer(secondsRemaining)}
                        </span>
                        <button
                            type="submit"
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                            title={secondsRemaining === 0 ? "Stop timer" : "Start timer"}
                        >
                            {secondsRemaining === 0 ? "Stop" : "Start"}
                        </button>
                        {timerRunning && (
                            <button
                                type="button"
                                onClick={() => setTimerRunning(false)}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                title="Pause timer"
                            >
                                Pause
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setTimerPoppedOut(true)}
                            className={`px-2 py-1 rounded text-xs ${secondsRemaining === 0 ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-gray-700 hover:bg-gray-600 text-white"}`}
                            title="Pop out timer into a draggable, resizable window"
                        >
                            ⤢
                        </button>
                    </form>
                ) : (
                    <button
                        type="button"
                        onClick={() => setTimerPoppedOut(false)}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-xs"
                        title="Dock timer back into the toolbar"
                    >
                        ⤡ Timer popped out
                    </button>
                )}

                {/* Right: draw tools */}
                <div className="flex items-center gap-2">
                    {/* Pan indicator (shown when draw is off) */}
                    {!drawingEnabled && (
                        <span className="text-gray-400 text-xs select-none" title="Click-drag to pan when zoomed in">
                            🖐 Pan
                        </span>
                    )}
                    <button
                        onClick={() => { setDrawingEnabled((d) => !d); setDrawTool("highlight"); }}
                        className={`px-3 py-1 rounded text-sm font-medium transition ${
                            drawingEnabled
                                ? "bg-yellow-400 text-gray-900 hover:bg-yellow-300"
                                : "bg-gray-700 text-white hover:bg-gray-600"
                        }`}
                        title="Toggle highlight drawing"
                    >
                        ✏️ Draw
                    </button>
                    {drawingEnabled && (
                        <>
                            {/* Highlight tool */}
                            <button
                                onClick={() => setDrawTool("highlight")}
                                className={`px-2 py-1 rounded text-xs font-medium transition border ${
                                    drawTool === "highlight"
                                        ? "bg-white text-gray-900 border-white"
                                        : "bg-transparent text-gray-300 border-gray-600 hover:border-gray-400"
                                }`}
                                title="Highlight (draw)"
                            >
                                ✏️
                            </button>
                            {/* Pencil tool — thin black line for precision writing */}
                            <button
                                onClick={() => setDrawTool("pencil")}
                                className={`px-2 py-1 rounded text-xs font-medium transition border ${
                                    drawTool === "pencil"
                                        ? "bg-white text-gray-900 border-white"
                                        : "bg-transparent text-gray-300 border-gray-600 hover:border-gray-400"
                                }`}
                                title="Pencil (thin black line)"
                            >
                                ✒️
                            </button>
                            {/* Eraser tool */}
                            <button
                                onClick={() => setDrawTool("eraser")}
                                className={`px-2 py-1 rounded text-xs font-medium transition border ${
                                    drawTool === "eraser"
                                        ? "bg-white text-gray-900 border-white"
                                        : "bg-transparent text-gray-300 border-gray-600 hover:border-gray-400"
                                }`}
                                title="Eraser"
                            >
                                🧹
                            </button>
                            {/* Color swatches — only shown for highlight tool */}
                            {drawTool === "highlight" && HIGHLIGHT_COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => setDrawColor(c.value)}
                                    className="w-6 h-6 rounded-full border-2 transition"
                                    style={{
                                        backgroundColor: c.value,
                                        borderColor: drawColor === c.value ? "#fff" : "transparent",
                                    }}
                                    title={c.label}
                                />
                            ))}
                            <button
                                onClick={undoPageDrawing}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                title="Undo the last mark on this page"
                            >
                                Undo
                            </button>
                            <button
                                onClick={clearPageDrawing}
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                title="Clear all marks on this page"
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Main image area ─────────────────────────────────────────── */}
            <div
                className="flex-1 flex items-center justify-center overflow-hidden relative"
                style={{ cursor: drawingEnabled ? "default" : isPanning ? "grabbing" : "grab" }}
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={onPanUp}
                onPointerCancel={onPanUp}
            >
                {/* Left arrow */}
                <button
                    onClick={goPrev}
                    disabled={pageIndex === 0 || loading}
                    className="absolute left-3 z-20 p-2 bg-gray-800 bg-opacity-70 hover:bg-opacity-90 text-white rounded-full text-xl disabled:opacity-20 transition"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                    title="Previous page (←)"
                >
                    ‹
                </button>

                {/* Loading state */}
                {loading && (
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                        <svg className="animate-spin w-10 h-10" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-sm">Loading lesson…</span>
                    </div>
                )}

                {/* Image + canvas wrapper */}
                {!loading && current && (
                <div
                    className="relative overflow-hidden"
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: "center center",
                        transition: isPanning ? "none" : "transform 0.15s ease",
                        maxWidth: "calc(100vw - 80px)",
                        maxHeight: "calc(100vh - 100px)",
                        lineHeight: 0,
                    }}
                >
                    <img
                        ref={imgRef}
                        key={`${lesson.id}-${pageIndex}`}
                        src={current.url}
                        alt={current.caption ?? `Page ${pageIndex + 1}`}
                        className="block max-w-full max-h-[calc(100vh-100px)] object-contain rounded shadow-2xl"
                        draggable={false}
                        onLoad={() => setImageLoaded(true)}
                    />
                    {imageLoaded && (
                        <DrawingCanvas
                            key={`canvas-${lesson.id}-${pageIndex}-${canvasKey[pageIndex] ?? 0}`}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            color={drawColor}
                            opacity={0.38}
                            tool={drawTool}
                            enabled={drawingEnabled}
                            undoVersion={canvasUndoVersion[pageIndex] ?? 0}
                        />
                    )}
                </div>
                )}

                {/* Right arrow */}
                <button
                    onClick={goNext}
                    disabled={pageIndex === totalPages - 1 || loading}
                    className="absolute right-3 z-20 p-2 bg-gray-800 bg-opacity-70 hover:bg-opacity-90 text-white rounded-full text-xl disabled:opacity-20 transition"
                    style={{ top: "50%", transform: "translateY(-50%)" }}
                    title="Next page (→)"
                >
                    ›
                </button>
            </div>

            {/* ── Caption bar ─────────────────────────────────────────────── */}
            {!loading && current?.caption && (
                <div className="flex-shrink-0 text-center text-gray-300 text-sm py-2 px-6 bg-gray-900 border-t border-gray-700">
                    {current.caption}
                </div>
            )}

            {/* ── Bottom page dots ─────────────────────────────────────────── */}
            {!loading && totalPages > 1 && totalPages <= 30 && (
                <div className="flex-shrink-0 flex justify-center gap-1 py-2 bg-gray-900 border-t border-gray-700">
                    {pages.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => { setPageIndex(i); resetView(); }}
                            className={`w-2 h-2 rounded-full transition ${
                                i === pageIndex ? "bg-white" : "bg-gray-600 hover:bg-gray-400"
                            }`}
                            title={`Page ${i + 1}`}
                        />
                    ))}
                </div>
            )}
            {!loading && totalPages > 30 && (
                <div className="flex-shrink-0 flex justify-center items-center gap-2 py-2 bg-gray-900 border-t border-gray-700 text-gray-400 text-xs">
                    Page
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageIndex + 1}
                        className="w-14 text-center border border-gray-600 bg-gray-800 text-white rounded px-1 py-0.5"
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 1 && v <= totalPages) {
                                setPageIndex(v - 1);
                                resetView();
                            }
                        }}
                    />
                    of {totalPages}
                </div>
            )}

            {/* ── Popped-out draggable/resizable timer window ─────────────── */}
            {timerPoppedOut && (
                <div
                    className="fixed z-[80] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden"
                    style={{ left: floatPos.x, top: floatPos.y, width: floatSize.width, height: floatSize.height }}
                >
                    <div
                        className="flex items-center justify-between px-2 py-1 bg-gray-800 cursor-move select-none flex-shrink-0 touch-none"
                        onPointerDown={onFloatDragDown}
                        onPointerMove={onFloatDragMove}
                        onPointerUp={onFloatDragUp}
                        onPointerCancel={onFloatDragUp}
                    >
                        <span className="text-white text-xs font-semibold">⠿ Timer</span>
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => setTimerPoppedOut(false)}
                            className="text-gray-400 hover:text-white text-xs px-1"
                            title="Dock timer back into the toolbar"
                        >
                            ✕
                        </button>
                    </div>
                    <form
                        onSubmit={(event) => { event.preventDefault(); secondsRemaining === 0 ? resetTimer() : startTimer(); }}
                        className={`flex-1 flex flex-col items-center justify-center gap-2 p-2 ${secondsRemaining === 0 ? "bg-yellow-400 animate-pulse" : ""}`}
                    >
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={timerMinutes}
                            onChange={(event) => setTimerMinutes(event.target.value)}
                            className="w-16 bg-gray-800 text-center text-sm text-white outline-none rounded px-2 py-1"
                            placeholder="Min"
                            aria-label="Timer minutes"
                        />
                        <span
                            className={`font-mono font-bold ${secondsRemaining === 0 ? "text-gray-950" : "text-white"}`}
                            style={{ fontSize: Math.max(18, Math.min(floatSize.width, floatSize.height) / 3.2) }}
                        >
                            {formatTimer(secondsRemaining)}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="submit"
                                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                title={secondsRemaining === 0 ? "Stop timer" : "Start timer"}
                            >
                                {secondsRemaining === 0 ? "Stop" : "Start"}
                            </button>
                            {timerRunning && (
                                <button
                                    type="button"
                                    onClick={() => setTimerRunning(false)}
                                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs"
                                    title="Pause timer"
                                >
                                    Pause
                                </button>
                            )}
                        </div>
                    </form>
                    <div
                        onPointerDown={onFloatResizeDown}
                        onPointerMove={onFloatResizeMove}
                        onPointerUp={onFloatResizeUp}
                        onPointerCancel={onFloatResizeUp}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none"
                        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.35) 50%)" }}
                        title="Drag to resize"
                    />
                </div>
            )}
        </div>
    );
};

export default LessonViewer;
