import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResponsiveStill } from '../CharacterStill';

vi.mock('../../../utils/storageUtils', () => ({
    fetchAnimUrl: vi.fn(async (path: string) => `https://example.test/${path}`),
}));

describe('ResponsiveStill', () => {
    it('switches between resolved still images as the character state changes', async () => {
        const frames = { default: 'normal.png', wounded: 'wounded.png' };
        const { container, rerender } = render(<ResponsiveStill frames={frames} state="default" videoUrl="video.mp4" />);
        expect(document.querySelector('video')).toHaveAttribute('src', 'video.mp4');
        await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/normal.png'));
        rerender(<ResponsiveStill frames={frames} state="wounded" videoUrl="video.mp4" />);
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/wounded.png');
        rerender(<ResponsiveStill frames={frames} state="earnXp" videoUrl="video.mp4" />);
        expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/normal.png');
    });
});
