import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Tool = 'pen' | 'eraser' | 'fill';

const SIZE = 32;
const MAX_UNDO = 50;

interface Props {
    defaultName: string;
    frames: File[];
    onAddFrame: (file: File) => void;
    onRemoveFrame: (index: number) => void;
    onClose: () => void;
}

const hexToRgba = (hex: string): [number, number, number, number] => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
};

const PixelCanvasEditor: React.FC<Props> = ({ defaultName, frames, onAddFrame, onRemoveFrame, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [tool, setTool] = useState<Tool>('pen');
    const [color, setColor] = useState('#000000');
    const [showGrid, setShowGrid] = useState(true);

    const previews = useMemo(() => frames.map(f => URL.createObjectURL(f)), [frames]);
    useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

    const drawingRef = useRef(false);
    const lastCellRef = useRef<{ x: number; y: number } | null>(null);
    const undoRef = useRef<ImageData[]>([]);
    const redoRef = useRef<ImageData[]>([]);

    const getCtx = () => canvasRef.current!.getContext('2d', { willReadFrequently: true })!;

    const snapshot = () => {
        undoRef.current.push(getCtx().getImageData(0, 0, SIZE, SIZE));
        if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
        redoRef.current = [];
    };

    const undo = useCallback(() => {
        const prev = undoRef.current.pop();
        if (!prev) return;
        const ctx = getCtx();
        redoRef.current.push(ctx.getImageData(0, 0, SIZE, SIZE));
        ctx.putImageData(prev, 0, 0);
    }, []);

    const redo = useCallback(() => {
        const next = redoRef.current.pop();
        if (!next) return;
        const ctx = getCtx();
        undoRef.current.push(ctx.getImageData(0, 0, SIZE, SIZE));
        ctx.putImageData(next, 0, 0);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
            if (key === 'y') { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);

    const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: Math.min(SIZE - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * SIZE))),
            y: Math.min(SIZE - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * SIZE))),
        };
    };

    const paintCell = (x: number, y: number) => {
        const ctx = getCtx();
        if (tool === 'eraser') ctx.clearRect(x, y, 1, 1);
        else { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
    };

    // Bresenham line so fast pointer moves don't leave gaps between cells.
    const paintLine = (from: { x: number; y: number }, to: { x: number; y: number }) => {
        let { x, y } = from;
        const dx = Math.abs(to.x - x), dy = -Math.abs(to.y - y);
        const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            paintCell(x, y);
            if (x === to.x && y === to.y) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    };

    const floodFill = (sx: number, sy: number) => {
        const ctx = getCtx();
        const img = ctx.getImageData(0, 0, SIZE, SIZE);
        const d = img.data;
        const idx = (x: number, y: number) => (y * SIZE + x) * 4;
        const start = idx(sx, sy);
        const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
        const fill = hexToRgba(color);
        if (target.every((v, i) => v === fill[i])) return;
        const matches = (i: number) => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
        const stack = [[sx, sy]];
        while (stack.length) {
            const [x, y] = stack.pop()!;
            if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
            const i = idx(x, y);
            if (!matches(i)) continue;
            d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = 255;
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        ctx.putImageData(img, 0, 0);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const cell = cellAt(e);
        snapshot();
        if (tool === 'fill') { floodFill(cell.x, cell.y); return; }
        drawingRef.current = true;
        lastCellRef.current = cell;
        paintCell(cell.x, cell.y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current || !lastCellRef.current) return;
        const cell = cellAt(e);
        paintLine(lastCellRef.current, cell);
        lastCellRef.current = cell;
    };

    const endStroke = () => { drawingRef.current = false; lastCellRef.current = null; };

    // Moves the painted pixels; anything pushed past the edge is cropped.
    const shift = (dx: number, dy: number) => {
        const ctx = getCtx();
        snapshot();
        const copy = document.createElement('canvas');
        copy.width = SIZE; copy.height = SIZE;
        copy.getContext('2d')!.drawImage(canvasRef.current!, 0, 0);
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.drawImage(copy, dx, dy);
    };

    const clear = () => { snapshot(); getCtx().clearRect(0, 0, SIZE, SIZE); };

    const toPngBlob = () => new Promise<Blob | null>(resolve => canvasRef.current!.toBlob(resolve, 'image/png'));

    const savePng = async () => {
        const blob = await toPngBlob();
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${defaultName || 'pixel-character'}.png`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const addFrame = async () => {
        const blob = await toPngBlob();
        if (!blob) return;
        onAddFrame(new File([blob], `drawn_${Date.now()}.png`, { type: 'image/png' }));
    };

    // Loads a queued frame back onto the canvas so it can be tweaked into the next frame.
    const loadFrame = (src: string) => {
        const img = new Image();
        img.onload = () => {
            snapshot();
            const ctx = getCtx();
            ctx.clearRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, 0, 0, SIZE, SIZE);
        };
        img.src = src;
    };

    const btn = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';
    const idle = 'bg-gray-800 text-gray-300 hover:bg-gray-700';

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-gray-950 select-none">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
                {(['pen', 'eraser', 'fill'] as Tool[]).map(t => (
                    <button key={t} onClick={() => setTool(t)} className={`${btn} ${tool === t ? 'bg-cyan-700 text-white' : idle}`}>
                        {t === 'pen' ? '✏️ Pen' : t === 'eraser' ? '🧹 Eraser' : '🪣 Fill'}
                    </button>
                ))}
                <div className="relative w-7 h-7 rounded-full overflow-hidden border-2 border-gray-600 shrink-0">
                    <div className="absolute inset-0" style={{ background: color }} />
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Color" />
                </div>
                <button onClick={() => setShowGrid(g => !g)} className={`${btn} ${showGrid ? 'bg-gray-700 text-white' : idle}`}>Grid</button>

                <div className="flex items-center gap-1 ml-2" title="Move the drawing">
                    <span className="text-gray-500 text-xs">Move</span>
                    <button onClick={() => shift(0, -1)} className={`${btn} ${idle}`} aria-label="Move up">↑</button>
                    <button onClick={() => shift(0, 1)} className={`${btn} ${idle}`} aria-label="Move down">↓</button>
                    <button onClick={() => shift(-1, 0)} className={`${btn} ${idle}`} aria-label="Move left">←</button>
                    <button onClick={() => shift(1, 0)} className={`${btn} ${idle}`} aria-label="Move right">→</button>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                    <button onClick={undo} className={`${btn} ${idle}`} title="Undo (Ctrl+Z)">↩</button>
                    <button onClick={redo} className={`${btn} ${idle}`} title="Redo (Ctrl+Y)">↪</button>
                    <button onClick={clear} className={`${btn} bg-gray-800 text-gray-400 hover:bg-red-900/40 hover:text-red-400`}>🗑 Clear</button>
                    <button onClick={savePng} className={`${btn} bg-cyan-600 hover:bg-cyan-500 text-white`}>Save PNG</button>
                    <button onClick={addFrame} className={`${btn} bg-green-600 hover:bg-green-500 text-white`} title="Add this drawing as the next frame to upload">
                        Add as frame ({frames.length})
                    </button>
                    <button onClick={onClose} className={`${btn} bg-gray-700 text-white hover:bg-gray-600`}>Done</button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/70 border-b border-gray-800 overflow-x-auto">
                <span className="text-xs text-gray-400 shrink-0">
                    Frames to upload ({frames.length}): <b>Add as frame</b> queues the canvas; <b>Save PNG</b> only downloads the current canvas.
                </span>
                {previews.map((src, i) => (
                    <div key={src} className="relative shrink-0 group">
                        <img
                            src={src}
                            alt={`frame ${i}`}
                            title="Click to load onto the canvas"
                            onClick={() => loadFrame(src)}
                            className="w-10 h-10 border border-gray-600 cursor-pointer bg-gray-700"
                            style={{ imageRendering: 'pixelated' }}
                        />
                        <span className="absolute bottom-0 left-0 text-[9px] bg-black/70 text-white px-0.5">{i + 1}</span>
                        <button
                            onClick={() => onRemoveFrame(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none hidden group-hover:block"
                            aria-label={`Remove frame ${i + 1}`}
                        >×</button>
                    </div>
                ))}
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <div
                    className="relative rounded shadow-2xl"
                    style={{
                        height: 'min(100%, 90vw)',
                        aspectRatio: '1 / 1',
                        backgroundColor: '#fff',
                        backgroundImage: 'repeating-conic-gradient(#d4d4d8 0% 25%, #fff 0% 50%)',
                        backgroundSize: '32px 32px',
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        width={SIZE}
                        height={SIZE}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endStroke}
                        onPointerCancel={endStroke}
                        className="absolute inset-0 w-full h-full"
                        style={{ imageRendering: 'pixelated', touchAction: 'none', cursor: 'crosshair' }}
                    />
                    {showGrid && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)',
                                backgroundSize: `${100 / SIZE}% ${100 / SIZE}%`,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PixelCanvasEditor;
