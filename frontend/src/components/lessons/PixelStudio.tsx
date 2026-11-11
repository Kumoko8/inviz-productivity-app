import React, { useEffect, useRef, useState } from 'react';
import PixelCanvasEditor from '../PixelCanvasEditor';
import { downloadPixelFile, exportPixelVideo, makePixelProject, readPixelProject } from './pixelStudioFiles';

interface Props {
    onClose: () => void;
}

const PixelStudio: React.FC<Props> = ({ onClose }) => {
    const [frames, setFrames] = useState<File[]>([]);
    const [fpsInput, setFpsInput] = useState('6');
    const fps = Number(fpsInput);
    const validFps = fpsInput.trim() !== '' && Number.isInteger(fps) && fps >= 1 && fps <= 30;
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            abortRef.current?.abort();
        };
    }, []);

    const run = async (action: () => Promise<void>, success: string) => {
        setBusy(true);
        setMessage(null);
        try {
            await action();
            if (mountedRef.current) setMessage({ error: false, text: success });
        } catch (error) {
            if (mountedRef.current) {
                console.error('Pixel Studio:', error);
                setMessage({ error: true, text: error instanceof Error ? error.message : 'Pixel Studio operation failed.' });
            }
        } finally {
            if (mountedRef.current) setBusy(false);
        }
    };

    const close = () => {
        if (busy) {
            setMessage({ error: true, text: 'Wait for the current operation to finish before closing.' });
            return;
        }
        if (window.confirm('Close Pixel Studio? Unsaved frames and the current canvas will be lost.')) onClose();
    };

    const saveProject = () => run(async () => {
        const project = await makePixelProject(frames, fps);
        if (mountedRef.current) downloadPixelFile(project, 'pixel-studio-project.json');
    }, 'Project downloaded. Open it later to edit the queued frames.');

    const openProject = (file: File) => {
        if (frames.length && !window.confirm('Replace the current frames with this project? The current canvas is not changed.')) return;
        void run(async () => {
            const project = await readPixelProject(file);
            if (mountedRef.current) {
                setFrames(project.frames);
                setFpsInput(String(project.fps));
            }
        }, 'Project opened. Select a frame to load it onto the canvas.');
    };

    const saveVideo = () => run(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const video = await exportPixelVideo(frames, fps, controller.signal);
            if (!controller.signal.aborted) downloadPixelFile(video, 'pixel-studio-animation.webm');
        } finally {
            abortRef.current = null;
        }
    }, 'Video downloaded.');

    return (
        <PixelCanvasEditor
            defaultName="pixel-studio"
            frames={frames}
            onAddFrame={file => setFrames(prev => [...prev, file])}
            onRemoveFrame={index => setFrames(prev => prev.filter((_, i) => i !== index))}
            frameQueueLabel="Studio frames"
            onClose={close}
            frameControls={
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 text-sm">
                    <label className="text-gray-300 flex items-center gap-1">
                        FPS
                        <input
                            type="number" min={1} max={30} step={1} value={fpsInput}
                            onChange={event => setFpsInput(event.target.value)}
                            className="w-16 rounded bg-gray-800 px-2 py-1 text-white"
                            disabled={busy}
                        />
                    </label>
                    <button onClick={saveVideo} disabled={busy || !frames.length || !validFps} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white disabled:opacity-50">
                        {busy ? 'Working…' : 'Download WebM'}
                    </button>
                    <button onClick={saveProject} disabled={busy || !frames.length || !validFps} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white disabled:opacity-50">
                        Save project
                    </button>
                    <label className={`px-3 py-1.5 rounded-lg bg-gray-700 text-white ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
                        Open project
                        <input
                            type="file" accept=".json,application/json" className="sr-only" disabled={busy}
                            onChange={event => {
                                const file = event.target.files?.[0];
                                event.target.value = '';
                                if (file) openProject(file);
                            }}
                        />
                    </label>
                    <span className="text-gray-400 text-xs">Queue each frame first. Video uses a white background; keep this tab open during export.</span>
                    {message && <span role={message.error ? 'alert' : 'status'} className={message.error ? 'text-red-400' : 'text-green-400'}>{message.text}</span>}
                </div>
            }
        />
    );
};

export default PixelStudio;
