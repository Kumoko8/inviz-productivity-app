import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    makeProject: vi.fn(),
    readProject: vi.fn(),
    exportVideo: vi.fn(),
    download: vi.fn(),
}));
vi.mock('../../PixelCanvasEditor', () => ({
    default: (props: {
        frames: File[]; onAddFrame: (file: File) => void; onClose: () => void; frameControls: React.ReactNode;
    }) => (
        <div>
            <span>Frames: {props.frames.length}</span>
            <button onClick={() => props.onAddFrame(new File(['frame'], 'frame.png', { type: 'image/png' }))}>Add frame</button>
            <button onClick={props.onClose}>Done</button>
            {props.frameControls}
        </div>
    ),
}));
vi.mock('../pixelStudioFiles', () => ({
    makePixelProject: mocks.makeProject,
    readPixelProject: mocks.readProject,
    exportPixelVideo: mocks.exportVideo,
    downloadPixelFile: mocks.download,
}));

import PixelStudio from '../PixelStudio';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.makeProject.mockResolvedValue(new Blob(['project']));
    mocks.exportVideo.mockResolvedValue(new Blob(['video']));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Pixel Studio', () => {
    it('downloads the queued frames as a project and video', async () => {
        render(<PixelStudio onClose={vi.fn()} />);
        expect(screen.getByText('Download WebM')).toBeDisabled();
        fireEvent.click(screen.getByText('Add frame'));
        fireEvent.change(screen.getByLabelText('FPS'), { target: { value: '12' } });
        fireEvent.click(screen.getByText('Save project'));
        await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), 'pixel-studio-project.json'));
        expect(mocks.makeProject).toHaveBeenCalledWith([expect.any(File)], 12);
        fireEvent.click(screen.getByText('Download WebM'));
        await waitFor(() => expect(mocks.download).toHaveBeenCalledWith(expect.any(Blob), 'pixel-studio-animation.webm'));
        expect(mocks.exportVideo).toHaveBeenCalledWith([expect.any(File)], 12, expect.any(AbortSignal));
    });

    it('opens a saved project and reports errors', async () => {
        render(<PixelStudio onClose={vi.fn()} />);
        const file = new File(['project'], 'project.json', { type: 'application/json' });
        mocks.readProject.mockResolvedValue({ frames: [new File(['frame'], 'one.png')], fps: 15 });
        fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [file] } });
        expect(await screen.findByText('Frames: 1')).toBeInTheDocument();
        expect(screen.getByLabelText('FPS')).toHaveValue(15);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        mocks.readProject.mockRejectedValue(new Error('Invalid project'));
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [file] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid project');
        expect(screen.getByText('Frames: 1')).toBeInTheDocument();
        log.mockRestore();
    });
});
