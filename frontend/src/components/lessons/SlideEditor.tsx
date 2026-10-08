import React, { useEffect, useRef, useState } from "react";
import type { CustomSlideSettings } from "./lessonsData";

interface Props {
    initialValue?: CustomSlideSettings;
    onSave: (file: File, settings: CustomSlideSettings) => void;
    onCancel: () => void;
}

const W = 1280;
const H = 720;
const PADDING = 80;

const BACKGROUNDS = ["#111827", "#ffffff", "#1e3a8a", "#065f46", "#eb7beb", "#fef3c7"];
const TEXT_COLORS = ["#ffffff", "#111827", "#facc15", "#93c5fd"];
const SIZES = [
    { label: "S", px: 48 },
    { label: "M", px: 72 },
    { label: "L", px: 96 },
];

function drawSlide(
    canvas: HTMLCanvasElement,
    text: string,
    bg: string,
    color: string,
    size: number
) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${size}px sans-serif`;

    const maxWidth = W - PADDING * 2;
    const lines: string[] = [];
    for (const para of text.split("\n")) {
        const words = para.split(/\s+/).filter(Boolean);
        if (words.length === 0) { lines.push(""); continue; }
        let line = "";
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(test).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        lines.push(line);
    }

    const lineHeight = size * 1.3;
    const startY = H / 2 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineHeight, maxWidth));
}

const SlideEditor: React.FC<Props> = ({ initialValue, onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState(initialValue?.text ?? "");
    const [bg, setBg] = useState(initialValue?.background ?? BACKGROUNDS[0]);
    const [color, setColor] = useState(initialValue?.textColor ?? TEXT_COLORS[0]);
    const [size, setSize] = useState(initialValue?.fontSize ?? SIZES[1].px);

    useEffect(() => {
        if (canvasRef.current) drawSlide(canvasRef.current, text, bg, color, size);
    }, [text, bg, color, size]);

    const save = () => {
        const canvas = canvasRef.current;
        if (!canvas || !text.trim()) return;
        canvas.toBlob(blob => {
            if (!blob) return;
            onSave(
                new File([blob], `slide-${Date.now()}.png`, { type: "image/png" }),
                { text, background: bg, textColor: color, fontSize: size }
            );
        }, "image/png");
    };

    const optBtn = (active: boolean) =>
        `px-3 py-1 rounded-lg text-sm border transition ${active ? "border-yellow-400 bg-yellow-400/20 text-yellow-300" : "border-gray-600 bg-gray-800 text-gray-300"}`;

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-700 shadow-xl flex flex-col max-h-[95vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <h3 className="text-white font-bold text-lg">
                        {initialValue ? "Edit Custom Slide" : "Create Custom Slide"}
                    </h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
                    <canvas
                        ref={canvasRef}
                        width={W}
                        height={H}
                        className="w-full rounded-lg border border-gray-700"
                    />
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Type your slide text…"
                        rows={4}
                        autoFocus
                        className="w-full bg-white/5 text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25"
                    />
                    <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs uppercase">Background</span>
                            {BACKGROUNDS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setBg(c)}
                                    aria-label={`Background ${c}`}
                                    className={`w-6 h-6 rounded-full border-2 ${bg === c ? "border-yellow-400" : "border-gray-600"}`}
                                    style={{ background: c }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs uppercase">Text</span>
                            {TEXT_COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    aria-label={`Text color ${c}`}
                                    className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-yellow-400" : "border-gray-600"}`}
                                    style={{ background: c }}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400 text-xs uppercase">Size</span>
                            {SIZES.map(s => (
                                <button key={s.label} onClick={() => setSize(s.px)} className={optBtn(size === s.px)}>
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-gray-700">
                    <button
                        onClick={save}
                        disabled={!text.trim()}
                        className="w-full py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-30"
                    >
                        {initialValue ? "Save Slide Changes" : "Save Slide"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SlideEditor;
