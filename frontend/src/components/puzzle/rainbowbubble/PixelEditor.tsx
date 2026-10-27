import React, { useEffect, useRef, useState } from 'react';
import { EMPTY_PIXELS, GRID, PALETTE, TRANSPARENT } from './rainbowBubbleTypes';

type Tool = 'pencil' | 'eraser' | 'fill';

interface Props {
    pixels: string;
    onChange: (pixels: string) => void;
}

const VIEW = 320;
const PX = VIEW / GRID;

function setPixel(pixels: string, i: number, ch: string): string {
    return pixels.slice(0, i) + ch + pixels.slice(i + 1);
}

function floodFill(pixels: string, start: number, ch: string): string {
    const target = pixels[start];
    if (target === ch) return pixels;
    const out = pixels.split('');
    const stack = [start];
    while (stack.length) {
        const i = stack.pop()!;
        if (out[i] !== target) continue;
        out[i] = ch;
        const x = i % GRID;
        if (x > 0) stack.push(i - 1);
        if (x < GRID - 1) stack.push(i + 1);
        if (i >= GRID) stack.push(i - GRID);
        if (i < GRID * (GRID - 1)) stack.push(i + GRID);
    }
    return out.join('');
}

const PixelEditor: React.FC<Props> = ({ pixels, onChange }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [color, setColor] = useState(5);
    const [tool, setTool] = useState<Tool>('pencil');
    const painting = useRef(false);
    const latest = useRef(pixels);
    latest.current = pixels;

    useEffect(() => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        for (let i = 0; i < GRID * GRID; i++) {
            const x = (i % GRID) * PX, y = Math.floor(i / GRID) * PX;
            ctx.fillStyle = ((i % GRID) + Math.floor(i / GRID)) % 2 ? '#1f2937' : '#273244';
            ctx.fillRect(x, y, PX, PX);
            const idx = pixels[i] === TRANSPARENT ? -1 : parseInt(pixels[i], 36);
            if (PALETTE[idx]) {
                ctx.fillStyle = PALETTE[idx];
                ctx.fillRect(x, y, PX, PX);
            }
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let k = 1; k < GRID; k++) {
            ctx.beginPath(); ctx.moveTo(k * PX, 0); ctx.lineTo(k * PX, VIEW); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, k * PX); ctx.lineTo(VIEW, k * PX); ctx.stroke();
        }
    }, [pixels]);

    const cellAt = (e: React.PointerEvent<HTMLCanvasElement>): number | null => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
        return y * GRID + x;
    };

    const paint = (i: number) => {
        const ch = tool === 'eraser' ? TRANSPARENT : color.toString(36);
        const next = tool === 'fill' ? floodFill(latest.current, i, ch) : setPixel(latest.current, i, ch);
        if (next !== latest.current) {
            latest.current = next;
            onChange(next);
        }
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <canvas
                ref={canvasRef} width={VIEW} height={VIEW}
                className="rounded-lg border border-gray-700 touch-none cursor-crosshair"
                style={{ width: '100%', maxWidth: VIEW, imageRendering: 'pixelated' }}
                onPointerDown={e => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const i = cellAt(e);
                    if (i === null) return;
                    painting.current = tool !== 'fill';
                    paint(i);
                }}
                onPointerMove={e => {
                    if (!painting.current) return;
                    const i = cellAt(e);
                    if (i !== null) paint(i);
                }}
                onPointerUp={() => { painting.current = false; }}
                onPointerCancel={() => { painting.current = false; }}
            />
            <div className="flex gap-1.5">
                {(['pencil', 'eraser', 'fill'] as Tool[]).map(t => (
                    <button key={t} onClick={() => setTool(t)}
                        className={`text-xs px-2.5 py-1 rounded-lg border capitalize ${tool === t ? 'bg-purple-700 border-purple-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                        {t}
                    </button>
                ))}
                <button onClick={() => onChange(EMPTY_PIXELS)}
                    className="text-xs px-2.5 py-1 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-white">
                    Clear
                </button>
            </div>
            <div className="grid grid-cols-12 gap-1" style={{ maxWidth: VIEW }}>
                {PALETTE.map((c, i) => (
                    <button key={i} onClick={() => { setColor(i); if (tool === 'eraser') setTool('pencil'); }}
                        className="rounded"
                        style={{
                            width: 22, height: 22, background: c,
                            outline: color === i && tool !== 'eraser' ? '2px solid white' : '1px solid #374151',
                        }}
                        title={c} />
                ))}
            </div>
        </div>
    );
};

export default PixelEditor;
