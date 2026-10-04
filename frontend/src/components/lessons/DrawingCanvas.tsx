import React, { useRef, useEffect, useCallback, useState } from "react";

export type DrawTool = 'highlight' | 'eraser' | 'pencil';

interface Props {
    width: number;
    height: number;
    color?: string;
    opacity?: number;
    tool: DrawTool;
    // When false, the canvas ignores pointer input (e.g. while panning) but
    // keeps its drawn paths intact instead of unmounting.
    enabled?: boolean;
    undoVersion?: number;
}

type PathRecord = {
    points: { x: number; y: number }[];
    color: string;
    opacity: number;
    isEraser: boolean;
    isPencil: boolean;
};

const HIGHLIGHT_WIDTH = 28;
const ERASER_WIDTH = 52;
const PENCIL_WIDTH = 3;
const PENCIL_COLOR = "#000000";

// Canvas-based drawing overlay. Highlights use source-over; eraser uses
// destination-out so it cuts holes in the highlight layer.
const DrawingCanvas: React.FC<Props> = ({
    width,
    height,
    color = "#facc15",
    opacity = 0.38,
    tool,
    enabled = true,
    undoVersion = 0,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [paths, setPaths] = useState<PathRecord[]>([]);
    // Keep a ref mirroring activePath so pointer-up can read it without stale closure.
    const activePathRef = useRef<PathRecord | null>(null);
    const [activePath, setActivePath] = useState<PathRecord | null>(null);
    const isDrawing = useRef(false);
    const lastUndoVersion = useRef(undoVersion);

    // Re-render the canvas whenever committed or active paths change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawPath = (p: PathRecord) => {
            if (p.points.length < 2) return;
            ctx.save();
            ctx.globalCompositeOperation = p.isEraser ? "destination-out" : "source-over";
            ctx.globalAlpha = p.isEraser ? 1 : p.opacity;
            ctx.strokeStyle = p.isEraser ? "rgba(0,0,0,1)" : p.color;
            ctx.lineWidth = p.isEraser ? ERASER_WIDTH : p.isPencil ? PENCIL_WIDTH : HIGHLIGHT_WIDTH;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) {
                ctx.lineTo(p.points[i].x, p.points[i].y);
            }
            ctx.stroke();
            ctx.restore();
        };

        for (const p of paths) drawPath(p);
        if (activePath) drawPath(activePath);
    }, [paths, activePath]);

    const toCanvas = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
            const canvas = canvasRef.current;
            if (!canvas) return { x: 0, y: 0 };
            const rect = canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * width;
            const y = ((e.clientY - rect.top) / rect.height) * height;
            return { x, y };
        },
        [width, height]
    );

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!enabled || e.button === 2) return;
            (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            isDrawing.current = true;
            const pt = toCanvas(e);
            const isPencil = tool === "pencil";
            const newPath: PathRecord = {
                points: [pt, pt],
                color: isPencil ? PENCIL_COLOR : color,
                opacity: isPencil ? 1 : opacity,
                isEraser: tool === "eraser",
                isPencil,
            };
            activePathRef.current = newPath;
            setActivePath(newPath);
        },
        [toCanvas, color, opacity, tool, enabled]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLCanvasElement>) => {
            if (!enabled || !isDrawing.current || !activePathRef.current) return;
            const pt = toCanvas(e);
            const updated = {
                ...activePathRef.current,
                points: [...activePathRef.current.points, pt],
            };
            activePathRef.current = updated;
            setActivePath(updated);
        },
        [toCanvas, enabled]
    );

    const onPointerUp = useCallback(() => {
        if (!isDrawing.current) return;
        isDrawing.current = false;
        const ap = activePathRef.current;
        if (ap && ap.points.length >= 2) {
            setPaths((prev) => [...prev, ap]);
        }
        activePathRef.current = null;
        setActivePath(null);
    }, []);

    const clearAll = useCallback(() => {
        setPaths([]);
        activePathRef.current = null;
        setActivePath(null);
        isDrawing.current = false;
    }, []);

    useEffect(() => {
        if (undoVersion === lastUndoVersion.current) return;
        lastUndoVersion.current = undoVersion;
        setPaths((prev) => prev.slice(0, -1));
        activePathRef.current = null;
        setActivePath(null);
        isDrawing.current = false;
    }, [undoVersion]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") clearAll();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [clearAll]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 w-full h-full z-10 select-none"
            style={{
                cursor: tool === "eraser" ? "cell" : "crosshair",
                pointerEvents: enabled ? "auto" : "none",
                touchAction: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onContextMenu={(e) => {
                if (!enabled) return;
                e.preventDefault();
                clearAll();
            }}
        />
    );
};

export default DrawingCanvas;
