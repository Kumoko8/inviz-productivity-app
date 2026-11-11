const PROJECT_TYPE = 'inviz-pixel-studio';
const PROJECT_VERSION = 1;
const MAX_PROJECT_BYTES = 50 * 1024 * 1024;
const PNG_PREFIX = 'data:image/png;base64,';

function readDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
            ? resolve(reader.result)
            : reject(new Error('Could not read a frame.'));
        reader.onerror = () => reject(new Error('Could not read a frame.'));
        reader.readAsDataURL(file);
    });
}

export async function makePixelProject(frames: File[], fps: number): Promise<Blob> {
    if (!frames.length) throw new Error('Add at least one frame before saving a project.');
    if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error('Choose a frame rate from 1 to 30 FPS.');
    const images = await Promise.all(frames.map(readDataUrl));
    const project = new Blob([JSON.stringify({ type: PROJECT_TYPE, version: PROJECT_VERSION, fps, frames: images })], { type: 'application/json' });
    if (project.size > MAX_PROJECT_BYTES) throw new Error('The project exceeds the 50 MB limit.');
    return project;
}

export async function readPixelProject(file: File): Promise<{ frames: File[]; fps: number }> {
    if (file.size > MAX_PROJECT_BYTES) throw new Error('The project exceeds the 50 MB limit.');
    let data: unknown;
    try {
        data = JSON.parse(await file.text());
    } catch {
        throw new Error('Could not read the project file.');
    }
    if (!data || typeof data !== 'object' || !('type' in data) || data.type !== PROJECT_TYPE ||
        !('version' in data) || data.version !== PROJECT_VERSION ||
        !('fps' in data) || typeof data.fps !== 'number' || !Number.isInteger(data.fps) || data.fps < 1 || data.fps > 30 ||
        !('frames' in data) || !Array.isArray(data.frames) || data.frames.length === 0) {
        throw new Error('This is not a valid Pixel Studio project.');
    }
    const frames = data.frames.map((value: unknown, index: number) => {
        if (typeof value !== 'string' || !value.startsWith(PNG_PREFIX)) {
            throw new Error(`Frame ${index + 1} is not a PNG image.`);
        }
        let bytes: string;
        try {
            bytes = atob(value.slice(PNG_PREFIX.length));
        } catch {
            throw new Error(`Frame ${index + 1} is not a valid PNG image.`);
        }
        if (!bytes.startsWith('\x89PNG\r\n\x1a\n')) throw new Error(`Frame ${index + 1} is not a valid PNG image.`);
        return new File([Uint8Array.from(bytes, c => c.charCodeAt(0))], `frame-${index + 1}.png`, { type: 'image/png' });
    });
    await Promise.all(frames.map(loadFrame));
    return { frames, fps: data.fps };
}

function loadFrame(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            if (image.naturalWidth !== 32 || image.naturalHeight !== 32) {
                reject(new Error(`${file.name} must be a 32 × 32 image.`));
            } else {
                resolve(image);
            }
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Could not load ${file.name}.`));
        };
        image.src = url;
    });
}

export async function exportPixelVideo(frames: File[], fps: number, signal: AbortSignal): Promise<Blob> {
    if (!frames.length) throw new Error('Add at least one frame before exporting.');
    if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error('Choose a frame rate from 1 to 30 FPS.');
    if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
        throw new Error('This browser does not support video export. Try a current version of Chrome or Firefox.');
    }
    const mimeType = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
        .find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('This browser cannot record WebM video.');

    const images = await Promise.all(frames.map(loadFrame));
    if (signal.aborted) throw new DOMException('Export cancelled.', 'AbortError');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create the video canvas.');
    ctx.imageSmoothingEnabled = false;
    const draw = (index: number) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(images[index], 0, 0, canvas.width, canvas.height);
    };
    draw(0);
    const stream = canvas.captureStream(60);
    let recorder: MediaRecorder;
    try {
        recorder = new MediaRecorder(stream, { mimeType });
    } catch (error) {
        stream.getTracks().forEach(track => track.stop());
        throw error;
    }
    return new Promise((resolve, reject) => {
        const chunks: Blob[] = [];
        let timer: ReturnType<typeof setTimeout> | undefined;
        let settled = false;
        const cleanup = () => {
            if (timer !== undefined) clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            stream.getTracks().forEach(track => track.stop());
        };
        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            if (recorder.state !== 'inactive') recorder.stop();
            cleanup();
            reject(error);
        };
        const abort = () => fail(new DOMException('Export cancelled.', 'AbortError'));
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => fail(new Error('Video recording failed.'));
        recorder.onstop = () => {
            if (settled) return;
            settled = true;
            cleanup();
            const blob = new Blob(chunks, { type: 'video/webm' });
            if (!blob.size) reject(new Error('The browser produced an empty video.'));
            else resolve(blob);
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); return; }
        try {
            recorder.start();
            let index = 0;
            const advance = () => {
                index++;
                if (index >= images.length) {
                    // Give the capture stream time to include the final frame's full interval.
                    draw(images.length - 1);
                    timer = setTimeout(() => recorder.stop(), 1000 / 30);
                } else {
                    draw(index);
                    timer = setTimeout(advance, 1000 / fps);
                }
            };
            timer = setTimeout(advance, 1000 / fps);
        } catch (error) {
            fail(error instanceof Error ? error : new Error('Could not start video recording.'));
        }
    });
}

export function downloadPixelFile(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
