import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportPixelVideo, makePixelProject, readPixelProject } from '../pixelStudioFiles';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
const frame = () => new File([png], 'frame.png', { type: 'image/png' });
const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsText(blob);
});

class MockImage {
    naturalWidth = 32;
    naturalHeight = 32;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
}

describe('Pixel Studio project files', () => {
    beforeEach(() => {
        vi.stubGlobal('Image', MockImage);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:frame');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

    it('saves and restores ordered frames and frame rate', async () => {
        const blob = await makePixelProject([frame(), frame()], 12);
        const text = await readBlob(blob);
        const projectFile = new File([text], 'project.json', { type: 'application/json' });
        Object.defineProperty(projectFile, 'text', { value: async () => text });
        const result = await readPixelProject(projectFile);
        expect(result.fps).toBe(12);
        expect(result.frames.map(f => f.name)).toEqual(['frame-1.png', 'frame-2.png']);
        expect(await readBlob(result.frames[0])).toBe(await readBlob(frame()));
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid projects and invalid frame rates', async () => {
        const bad = new File(['bad'], 'bad.json');
        Object.defineProperty(bad, 'text', { value: async () => '{"type":"other"}' });
        await expect(readPixelProject(bad)).rejects.toThrow('not a valid Pixel Studio project');
        await expect(makePixelProject([frame()], 0)).rejects.toThrow('1 to 30 FPS');
        await expect(makePixelProject([], 6)).rejects.toThrow('at least one frame');
    });
});

describe('Pixel Studio video export', () => {
    const drawImage = vi.fn();
    const stopTrack = vi.fn();
    let recorder: MockRecorder;
    class MockRecorder {
        static isTypeSupported = vi.fn((type: string) => type === 'video/webm;codecs=vp8');
        state: RecordingState = 'inactive';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() { recorder = this; }
        start() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            this.ondataavailable?.({ data: new Blob(['video'], { type: 'video/webm' }) });
            this.onstop?.();
        }
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('Image', MockImage);
        vi.stubGlobal('MediaRecorder', MockRecorder);
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:frame');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillRect: vi.fn(), drawImage, imageSmoothingEnabled: true,
        } as unknown as CanvasRenderingContext2D);
        Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', {
            configurable: true, value: vi.fn(() => ({ getTracks: () => [{ stop: stopTrack }] })),
        });
        drawImage.mockClear();
        stopTrack.mockClear();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
    });

    it('records frames in order for one frame interval each and releases tracks', async () => {
        const promise = exportPixelVideo([frame(), frame(), frame()], 2, new AbortController().signal);
        await vi.waitFor(() => expect(drawImage).toHaveBeenCalledTimes(1));
        expect(recorder.state).toBe('recording');
        await vi.advanceTimersByTimeAsync(500);
        expect(drawImage).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(500);
        expect(drawImage).toHaveBeenCalledTimes(3);
        await vi.advanceTimersByTimeAsync(500);
        expect(drawImage).toHaveBeenCalledTimes(4);
        await vi.advanceTimersByTimeAsync(34);
        const video = await promise;
        expect(video.type).toBe('video/webm');
        expect(video.size).toBeGreaterThan(0);
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('cancels recording and releases tracks', async () => {
        const controller = new AbortController();
        const promise = exportPixelVideo([frame()], 1, controller.signal);
        const rejection = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(drawImage).toHaveBeenCalledTimes(1));
        controller.abort();
        await rejection;
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('reports unsupported WebM recording', async () => {
        MockRecorder.isTypeSupported.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValueOnce(false);
        await expect(exportPixelVideo([frame()], 6, new AbortController().signal)).rejects.toThrow('cannot record WebM');
    });
});
