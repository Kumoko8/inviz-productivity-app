import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";

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
    /** Brush width in canvas pixels for the active tool */
    size: number;
    /** Previously saved markup (transparent PNG) drawn beneath new strokes */
    baseUrl?: string;
    /** Fired after any stroke, undo or clear so the parent can track unsaved changes */
    onChange?: () => void;
    /** Fired when the saved markup could not be loaded into the canvas */
    onBaseError?: () => void;
}

export interface DrawingCanvasHandle {
    toBlob: () => Promise<Blob | null>;
    clear: () => void;
}

type PathRecord = {
    points: { x: number; y: number }[];
    color: string;
    opacity: number;
    isEraser: boolean;
    isPencil: boolean;
    width: number;
};

// Canvas-based drawing overlay. Highlights use source-over; eraser uses
// destination-out so it cuts holes in the highlight layer.
const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(({
    width,
    height,
    color = "#facc15",
    opacity = 0.38,
    tool,
    enabled = true,
    undoVersion = 0,
    size,
    baseUrl,
    onChange,
    onBaseError,
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [paths, setPaths] = useState<PathRecord[]>([]);
    // Keep a ref mirroring activePath so pointer-up can read it without stale closure.
    const activePathRef = useRef<PathRecord | null>(null);
    const [activePath, setActivePath] = useState<PathRecord | null>(null);
    const isDrawing = useRef(false);
    const lastUndoVersion = useRef(undoVersion);
    const [base, setBase] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        setBase(null);
        if (!baseUrl) return;
        let cancelled = false;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { if (!cancelled) setBase(img); };
        img.onerror = () => { if (!cancelled) onBaseError?.(); };
        img.src = baseUrl;
        return () => { cancelled = true; };
    }, [baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

    // Re-render the canvas whenever committed or active paths change.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (base) ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

        const drawPath = (p: PathRecord) => {
            if (p.points.length < 2) return;
            ctx.save();
            ctx.globalCompositeOperation = p.isEraser ? "destination-out" : "source-over";
            ctx.globalAlpha = p.isEraser ? 1 : p.opacity;
            ctx.strokeStyle = p.isEraser ? "rgba(0,0,0,1)" : p.color;
            ctx.lineWidth = p.width;
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
    }, [paths, activePath, base]);

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
                color,
                opacity: isPencil ? 1 : opacity,
                isEraser: tool === "eraser",
                isPencil,
                width: size,
            };
            activePathRef.current = newPath;
            setActivePath(newPath);
        },
        [toCanvas, color, opacity, tool, enabled, size]
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
            onChange?.();
        }
        activePathRef.current = null;
        setActivePath(null);
    }, [onChange]);

    const clearAll = useCallback(() => {
        setPaths([]);
        setBase(null);
        onChange?.();
        activePathRef.current = null;
        setActivePath(null);
        isDrawing.current = false;
    }, [onChange]);

    useImperativeHandle(ref, () => ({
        toBlob: () =>
            new Promise((resolve) => {
                const canvas = canvasRef.current;
                if (!canvas) return resolve(null);
                canvas.toBlob((b) => resolve(b), "image/png");
            }),
        clear: clearAll,
    }), [clearAll]);

    useEffect(() => {
        if (undoVersion === lastUndoVersion.current) return;
        lastUndoVersion.current = undoVersion;
        setPaths((prev) => prev.slice(0, -1));
        onChange?.();
        activePathRef.current = null;
        setActivePath(null);
        isDrawing.current = false;
    }, [undoVersion]);

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
                if (enabled) e.preventDefault();
            }}
        />
    );
});

export default DrawingCanvas;
