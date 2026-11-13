import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useCharacterTransform from '../useCharacterTransform';
import { fetchAnimUrl } from '../../utils/storageUtils';

vi.mock('../../utils/storageUtils', () => ({
    fetchAnimUrl: vi.fn(async (path: string) => `url:${path}`),
}));

const character = {
    id: 'hero',
    name: 'Hero',
    level: 12,
    animation: 'original',
    transformIndex: 0,
    transformThresholds: [7, 12],
    transformAnimations: ['first', 'second'],
    transformTempAnimations: ['transition'],
};

function setup(saveCharacter: (c: typeof character) => Promise<void>) {
    const setAnimationUrl = vi.fn();
    const result = renderHook(() => {
        const [characters, setUserCharacters] = useState<Record<string, typeof character>>({ hero: character });
        const transform = useCharacterTransform({
            selectedCharacter: characters.hero,
            setUserCharacters,
            saveCharacter,
            setAnimationUrl,
        });
        return { ...transform, character: characters.hero };
    });
    return { ...result, setAnimationUrl };
}

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe('useCharacterTransform', () => {
    it('skips playback, persists the next form, and leaves later thresholds available', async () => {
        const save = vi.fn(async () => {});
        const { result, setAnimationUrl } = setup(save);

        await act(async () => { await result.current.finalizeTransform(); });

        expect(save).toHaveBeenCalledWith({ ...character, animation: 'first', transformIndex: 1 });
        expect(result.current.character.animation).toBe('first');
        expect(result.current.character.transformIndex).toBe(1);
        expect(result.current.transformReady).toBe(true);
        expect(fetchAnimUrl).not.toHaveBeenCalledWith('transition');
        expect(setAnimationUrl).toHaveBeenCalledWith('url:first');

        await act(async () => { await result.current.finalizeTransform(); });
        expect(result.current.character.transformIndex).toBe(2);
        expect(result.current.transformReady).toBe(false);
    });

    it('only finalizes once when skip and video end occur together', async () => {
        let completeSave!: () => void;
        const save = vi.fn(() => new Promise<void>(resolve => { completeSave = resolve; }));
        const { result } = setup(save);

        await act(async () => { await result.current.handleTransform(); });
        expect(result.current.transformOverlayUrl).toBe('url:transition');

        let pending!: Promise<void>;
        act(() => {
            pending = result.current.finalizeTransform();
            void result.current.finalizeTransform();
        });
        expect(result.current.transformFinalizing).toBe(true);
        expect(save).toHaveBeenCalledTimes(1);
        await act(async () => { completeSave(); await pending; });
        expect(result.current.transformOverlayUrl).toBeNull();
        expect(result.current.character.transformIndex).toBe(1);
    });

    it('keeps the prompt available and reports a failed save', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
        const { result } = setup(save);

        await act(async () => { await result.current.finalizeTransform(); });
        expect(result.current.transformReady).toBe(true);
        expect(result.current.transformPlaying).toBe(false);
        expect(result.current.character).toEqual(character);
        expect(result.current.transformError).toMatch(/could not save/i);

        await act(async () => { await result.current.finalizeTransform(); });
        await waitFor(() => expect(result.current.character.transformIndex).toBe(1));
        expect(result.current.transformError).toBeNull();
    });
});
