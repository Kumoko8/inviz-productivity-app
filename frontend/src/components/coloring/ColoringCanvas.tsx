import React, { useRef, useEffect, useState, useCallback } from 'react';
import { floodFill } from './coloringUtils';

// Preset palette for quick color selection
const PALETTE = [
    '#ffffff', '#000000', '#6b7280',
    '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#06b6d4', '#3b82f6',
    '#8b5cf6', '#ec4899', '#f43f5e',
    '#84cc16', '#14b8a6', '#a78bfa',
    '#fbbf24', '#fb923c', '#e879f9',
];

// Max undo steps (1 step ≈ canvas_width × canvas_height × 4 bytes)
const MAX_UNDO = 20;

export interface ColoringCanvasProps {
    imageUrl: string;
    onSaveBlob?: (blob: Blob) => Promise<void>;
}

export const ColoringCanvas: React.FC<ColoringCanvasProps> = ({ imageUrl, onSaveBlob }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageUrlRef = useRef(imageUrl);
    const undoStackRef = useRef<ImageData[]>([]);

    const [color, setColor] = useState('#ef4444');
    const [tolerance, setTolerance] = useState(32);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [undoCount, setUndoCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { imageUrlRef.current = imageUrl; }, [imageUrl]);

    // ─── Load image onto canvas ────────────────────────────────────────
    const loadImage = useCallback((url: string) => {
        setIsLoaded(false);
        setError(null);
        undoStackRef.current = [];
        setUndoCount(0);

        const img = new Image();
        img.crossOrigin = 'anonymous'; // required for getImageData
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            // White background so transparent PNGs color correctly
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            setIsLoaded(true);
        };
        img.onerror = () =>
            setError(
                'Image failed to load. If the canvas stays blank after enabling CORS, try re-uploading the image.'
            );
        img.src = url;
    }, []);

    useEffect(() => { loadImage(imageUrl); }, [imageUrl, loadImage]);

    // ─── Click to flood fill ──────────────────────────────────────────
    const handleCanvasClick = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            const canvas = canvasRef.current;
            if (!canvas || !isLoaded || isFilling) return;

            const ctx = canvas.getContext('2d')!;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * scaleX);
            const y = Math.floor((e.clientY - rect.top) * scaleY);

            let snapshot: ImageData;
            try {
                snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
            } catch {
                setError(
                    'Cannot read canvas pixels — this is a CORS issue. ' +
                    'Run: gsutil cors set cors.json gs://YOUR_BUCKET  (see README for cors.json contents)'
                );
                return;
            }

            setIsFilling(true);

            // Run fill asynchronously so the UI can update (spinner, etc.)
            setTimeout(() => {
                try {
                    // Save snapshot to undo stack BEFORE filling
                    const stack = undoStackRef.current;
                    undoStackRef.current = [...stack.slice(-(MAX_UNDO - 1)), snapshot];
                    setUndoCount(undoStackRef.current.length);

                    const toFill = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    floodFill(toFill, x, y, color, tolerance);
                    ctx.putImageData(toFill, 0, 0);
                } catch {
                    setError('Flood fill failed — unexpected pixel read error.');
                } finally {
                    setIsFilling(false);
                }
            }, 0);
        },
        [isLoaded, isFilling, color, tolerance]
    );

    // ─── Undo ─────────────────────────────────────────────────────────
    const handleUndo = () => {
        const canvas = canvasRef.current;
        if (!canvas || undoStackRef.current.length === 0) return;
        const ctx = canvas.getContext('2d')!;
        const prev = undoStackRef.current[undoStackRef.current.length - 1];
        ctx.putImageData(prev, 0, 0);
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setUndoCount(undoStackRef.current.length);
    };

    // ─── Clear ────────────────────────────────────────────────────────
    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas || !isLoaded) return;
        const ctx = canvas.getContext('2d')!;
        // Save current state to undo before clearing
        try {
            const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
            undoStackRef.current = [...undoStackRef.current.slice(-(MAX_UNDO - 1)), snap];
            setUndoCount(undoStackRef.current.length);
        } catch { /* ignore if tainted */ }
        // Reload original
        loadImage(imageUrlRef.current);
    };

    // ─── Save ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        const canvas = canvasRef.current;
        if (!canvas || !onSaveBlob || isSaving) return;
        setIsSaving(true);
        canvas.toBlob(async blob => {
            if (blob) await onSaveBlob(blob).catch(() => { });
            setIsSaving(false);
        }, 'image/png');
    };

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* ── Toolbar ── */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 px-4 py-2.5 bg-gray-900 border-b border-gray-800 shrink-0">
                {/* Color swatch + hex picker */}
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Color</label>
                    <div className="relative">
                        <input
                            type="color"
                            value={color}
                            onChange={e => setColor(e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-2 border-gray-600 bg-transparent p-0.5"
                            title="Pick fill color"
                        />
                    </div>
                    <span className="font-mono text-xs text-gray-400 uppercase">{color}</span>
                </div>

                {/* Palette swatches */}
                <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {PALETTE.map(c => (
                        <button
                            key={c}
                            title={c}
                            onClick={() => setColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded-sm border transition-transform hover:scale-110 ${color === c ? 'border-white scale-110 shadow-lg' : 'border-gray-600'
                                }`}
                        />
                    ))}
                </div>

                {/* Tolerance */}
                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400">Tolerance</label>
                    <input
                        type="range"
                        min={0}
                        max={120}
                        value={tolerance}
                        onChange={e => setTolerance(Number(e.target.value))}
                        className="w-20 accent-fuchsia-500"
                        title="How similar pixels must be to get filled (higher fills more)"
                    />
                    <span className="text-xs text-gray-400 w-6 text-right">{tolerance}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        onClick={handleUndo}
                        disabled={undoCount === 0}
                        className="px-3 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        ↩ Undo ({undoCount})
                    </button>
                    <button
                        onClick={handleClear}
                        disabled={!isLoaded}
                        className="px-3 py-1 text-xs rounded bg-gray-800 text-gray-400 hover:bg-red-900/40 hover:text-red-400 disabled:opacity-40 transition-colors"
                    >
                        Clear
                    </button>
                    {onSaveBlob && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !isLoaded}
                            className="px-3 py-1 text-xs rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-40 transition-colors"
                        >
                            {isSaving ? 'Saving…' : '💾 Save'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Canvas area ── */}
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-4 bg-gray-950 relative">
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 p-6">
                        <div className="bg-gray-900 border border-red-700/50 rounded-xl p-5 max-w-sm text-center">
                            <p className="text-red-400 font-bold mb-2">⚠ CORS Error</p>
                            <p className="text-gray-400 text-sm mb-3">{error}</p>
                            <p className="text-gray-600 text-xs">
                                Create a <code className="text-fuchsia-400">cors.json</code> with{' '}
                                <code className="text-cyan-400">{"[{\"origin\":[\"*\"],\"method\":[\"GET\"],\"maxAgeSeconds\":3600}]"}</code>{' '}
                                and run <code className="text-yellow-400">gsutil cors set cors.json gs://YOUR_BUCKET</code>
                            </p>
                        </div>
                    </div>
                )}

                {!isLoaded && !error && (
                    <div className="flex items-center gap-3 text-gray-400 text-sm">
                        <div className="w-5 h-5 border-2 border-gray-600 border-t-fuchsia-400 rounded-full animate-spin" />
                        Loading image…
                    </div>
                )}

                {isFilling && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/90 px-3 py-1 rounded-full text-xs text-fuchsia-300 pointer-events-none z-10">
                        Filling…
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className={`max-w-full max-h-full border border-gray-700 rounded shadow-xl ${isLoaded ? 'cursor-crosshair' : 'opacity-0'
                        }`}
                />
            </div>
        </div>
    );
};
