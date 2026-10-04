import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

const SIZES = [128, 256, 512] as const;

export const QrCodeGenerator: React.FC = () => {
    const [url, setUrl] = useState('');
    const [size, setSize] = useState<typeof SIZES[number]>(256);
    const [error, setError] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const trimmed = url.trim();
        const canvas = canvasRef.current;
        if (!canvas) return;

        if (!trimmed) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            setError(null);
            return;
        }

        QRCode.toCanvas(canvas, trimmed, { width: size, margin: 2 }, (err) => {
            setError(err ? 'Could not generate QR code for this input.' : null);
        });
    }, [url, size]);

    const handleDownload = () => {
        const canvas = canvasRef.current;
        if (!canvas || !url.trim()) return;
        const link = document.createElement('a');
        link.download = 'qr-code.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <div className="flex flex-col gap-4 p-4 max-w-sm mx-auto">
            <h2 className="text-lg font-semibold text-gray-800">QR Code Generator</h2>

            <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="Enter a URL…"
                className="w-full bg-white text-gray-800 text-sm px-3 py-2 rounded-lg border border-gray-300 outline-none placeholder-gray-400 focus:border-blue-400 transition-colors"
            />

            <div className="flex gap-2">
                {SIZES.map(s => (
                    <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                            size === s
                                ? 'border-purple-400 bg-purple-100 text-purple-700'
                                : 'border-gray-300 bg-gray-50 text-gray-500 hover:border-gray-400'
                        }`}
                    >
                        {s}px
                    </button>
                ))}
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <div className="flex items-center justify-center bg-white border border-gray-200 rounded-lg p-3 min-h-[160px]">
                <canvas ref={canvasRef} />
            </div>

            <button
                onClick={handleDownload}
                disabled={!url.trim()}
                className="text-white px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-30 text-sm font-medium"
            >
                Download PNG
            </button>
        </div>
    );
};

export default QrCodeGenerator;
