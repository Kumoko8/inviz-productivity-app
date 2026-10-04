import React, { useRef, useState, useEffect, useCallback } from 'react';
import { addDrawing } from '../../services/drawingService';
import type { DrawingRecord } from '../../services/drawingService';

type Tool = 'pen' | 'eraser';

// Internal canvas resolution — stays fixed regardless of display size.
const CANVAS_W = 600;
const CANVAS_H = 900;
const MAX_UNDO = 15;
// Minimum ms between undo snapshots — rapid strokes share one undo step.
const UNDO_THROTTLE_MS = 600;

interface Props {
    uid: string;
    charId: string;
    onSave: (record: DrawingRecord, strokeCount: number) => void;
    onClose: () => void;
}

export const DrawingCanvas: React.FC<Props> = ({ uid, charId, onSave, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const DRAFT_KEY = `drawing_draft_${charId}`;

    const [tool, setTool] = useState<Tool>('pen');
    const [brushSize, setBrushSize] = useState(4);
    const [penColor, setPenColor] = useState('#000000');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [hasDraft, setHasDraft] = useState(() => !!localStorage.getItem(`drawing_draft_${charId}`));

    const isDrawingRef = useRef(false);
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const lastMidRef  = useRef<{ x: number; y: number } | null>(null);
    const activePointerTypeRef = useRef<string | null>(null);
    const undoStackRef = useRef<ImageData[]>([]);
    const redoStackRef = useRef<ImageData[]>([]);
    const lastSnapshotTimeRef = useRef<number>(0);
    const strokeCountRef = useRef(0);

    // ─── Helpers ──────────────────────────────────────────────────────
    const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
            y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
        };
    };

    // Pressure: 0–1 from stylus, default 0.5 for mouse/touch
    const getSize = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        const scale = tool === 'pen' ? pressure * 1.4 + 0.3 : 1;
        return Math.max(1, brushSize * scale);
    };

    // Only snapshot if enough time has passed — batches rapid strokes into one undo step
    // and avoids the expensive getImageData on every pen-down.
    const saveSnapshot = useCallback((force = false) => {
        const now = performance.now();
        if (!force && now - lastSnapshotTimeRef.current < UNDO_THROTTLE_MS) return;
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const snap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        undoStackRef.current.push(snap);
        if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
        redoStackRef.current = [];
        lastSnapshotTimeRef.current = now;
    }, []);

    // ─── Initialise white canvas (and restore draft if one exists) ───
    useEffect(() => {
        const ctx = getCtx();
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
            img.src = draft;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Keyboard shortcuts ───────────────────────────────────────────
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
            if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // ─── Undo / Redo ─────────────────────────────────────────────────
    const undo = () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas || undoStackRef.current.length === 0) return;
        const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        redoStackRef.current.push(current);
        ctx.putImageData(undoStackRef.current.pop()!, 0, 0);
    };

    const redo = () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas || redoStackRef.current.length === 0) return;
        const current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        undoStackRef.current.push(current);
        ctx.putImageData(redoStackRef.current.pop()!, 0, 0);
    };

    const handleClear = () => {
        saveSnapshot(true);
        const ctx = getCtx();
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    };

    // ─── Pointer events ───────────────────────────────────────────────
    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        // Palm rejection: ignore touch if a pen stroke is already in progress
        if (activePointerTypeRef.current === 'pen' && e.pointerType === 'touch') return;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();
        saveSnapshot();
        isDrawingRef.current = true;
        activePointerTypeRef.current = e.pointerType;
        strokeCountRef.current += 1;
        const pos = getPos(e);
        lastPosRef.current = pos;
        lastMidRef.current  = null;

        // Dot on press
        const ctx = getCtx();
        if (!ctx) return;
        const size = getSize(e);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = tool === 'eraser' ? '#ffffff' : penColor;
        ctx.fill();
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return;
        // Palm rejection: ignore touch events while a pen is active
        if (activePointerTypeRef.current === 'pen' && e.pointerType === 'touch') return;
        e.preventDefault();
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;

        // Use coalesced events to recover high-frequency points (Apple Pencil 240 Hz, etc.)
        const events: PointerEvent[] = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
        const rect = canvas.getBoundingClientRect();

        for (const ce of events) {
            const pos = {
                x: ((ce.clientX - rect.left) / rect.width)  * CANVAS_W,
                y: ((ce.clientY - rect.top)  / rect.height) * CANVAS_H,
            };
            const pressure = ce.pressure > 0 ? ce.pressure : 0.5;
            const scale    = tool === 'pen' ? pressure * 1.4 + 0.3 : 1;
            const size     = Math.max(1, brushSize * scale);
            // Pressure → opacity: light touch fades the stroke naturally (pen only)
            const alpha    = tool === 'pen' ? Math.max(0.35, Math.min(1, pressure * 1.5)) : 1;

            const last = lastPosRef.current;
            if (!last) { lastPosRef.current = pos; continue; }

            // Quadratic bézier: from previous midpoint, through last point, to current midpoint
            const mid     = { x: (last.x + pos.x) / 2, y: (last.y + pos.y) / 2 };
            const fromPt  = lastMidRef.current ?? last;

            ctx.beginPath();
            ctx.moveTo(fromPt.x, fromPt.y);
            ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
            ctx.lineWidth       = size;
            ctx.lineCap         = 'round';
            ctx.lineJoin        = 'round';
            ctx.globalAlpha     = alpha;
            ctx.strokeStyle     = tool === 'eraser' ? '#ffffff' : penColor;
            ctx.stroke();
            ctx.globalAlpha     = 1;

            lastMidRef.current = mid;
            lastPosRef.current = pos;
        }
    };

    const handlePointerUp = () => {
        isDrawingRef.current = false;
        lastPosRef.current   = null;
        lastMidRef.current   = null;
        activePointerTypeRef.current = null;
    };

    // ─── Save for Later (draft to localStorage) ───────────────────────
    const handleSaveDraft = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            localStorage.setItem(DRAFT_KEY, canvas.toDataURL('image/jpeg', 0.8));
        } catch {
            // localStorage full or unavailable — just close silently
        }
        onClose();
    };

    // ─── Save ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setSaving(true);
        setSaveError(null);
        try {
            const blob = await new Promise<Blob>((resolve, reject) =>
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.7)
            );
            const record = await addDrawing(uid, charId, blob);
            localStorage.removeItem(DRAFT_KEY);
            setHasDraft(false);
            onSave(record, strokeCountRef.current);
        } catch {
            setSaveError('Save failed — check Storage/Firestore rules.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0 flex-wrap">
                {/* Pen */}
                <button
                    onClick={() => setTool('pen')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        tool === 'pen'
                            ? 'bg-cyan-700 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    ✏️ Pen
                </button>

                {/* Color swatch — only when pen active */}
                {tool === 'pen' && (
                    <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-gray-600 shrink-0">
                        <div className="absolute inset-0" style={{ background: penColor }} />
                        <input
                            type="color"
                            value={penColor}
                            onChange={e => setPenColor(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            aria-label="Pen color"
                        />
                    </div>
                )}

                {/* Eraser */}
                <button
                    onClick={() => setTool('eraser')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        tool === 'eraser'
                            ? 'bg-orange-700 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                    🧹 Eraser
                </button>

                {/* Brush size */}
                <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 text-xs">Size</span>
                    <input
                        type="range"
                        min={1}
                        max={40}
                        value={brushSize}
                        onChange={e => setBrushSize(Number(e.target.value))}
                        className="w-20 accent-cyan-500"
                        aria-label="Brush size"
                    />
                    <span className="text-gray-400 text-xs w-5 text-right">{brushSize}</span>
                </div>

                {/* Right side actions */}
                <div className="flex items-center gap-1.5 ml-auto">
                    <button
                        onClick={undo}
                        title="Undo (Ctrl+Z)"
                        className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                    >
                        ↩
                    </button>
                    <button
                        onClick={redo}
                        title="Redo (Ctrl+Y)"
                        className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded text-sm"
                    >
                        ↪
                    </button>
                    <button
                        onClick={handleClear}
                        className="px-2.5 py-1.5 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded text-sm"
                    >
                        🗑 Clear
                    </button>

                    {hasDraft && (
                        <span className="text-amber-400 text-xs font-medium">Draft restored</span>
                    )}

                    {saveError && (
                        <span className="text-red-400 text-xs max-w-[160px] truncate">{saveError}</span>
                    )}

                    <button
                        onClick={handleSaveDraft}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-amber-300 rounded-lg text-sm font-medium transition-colors"
                        title="Save draft and come back later"
                    >
                        Save for Later
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-lg leading-none ml-1"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Canvas area */}
            <div className="flex-1 flex items-center justify-center bg-gray-950 min-h-0 p-4">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    className="bg-white rounded-lg shadow-2xl max-w-full max-h-full"
                    style={{
                        touchAction: 'none',
                        cursor: tool === 'pen' ? 'crosshair' : 'cell',
                        willChange: 'transform',
                    }}
                />
            </div>
        </div>
    );
};
