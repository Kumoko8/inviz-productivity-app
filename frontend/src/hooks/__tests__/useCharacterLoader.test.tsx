import React from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const data = vi.hoisted(() => ({
    bases: [{ id: 'base1', name: 'Base One', animation: '', transformThresholds: [7], transformAnimations: ['base.mp4'], transformTempAnimations: ['base-temp.mp4'] }],
    users: {} as Record<string, unknown>,
}));

// Mock the characterService and userService before importing the hook
vi.mock('../../services/characterService', () => ({
    getCharacters: async () => data.bases,
    getUserCharacters: async () => data.users,
    writeUserCharacter: async () => { },
}));

vi.mock('../../services/userService', () => ({
    getUserDoc: async () => ({}),
}));

import useCharacterLoader from '../useCharacterLoader';

function TestHarness({ uid }: { uid: string | null }) {
    const { userCharacters, loaded } = useCharacterLoader(uid);
    return <div data-testid="out">{loaded ? Object.keys(userCharacters).join(',') : 'loading'}</div>;
}

describe('useCharacterLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes base characters in the merged userCharacters map', async () => {
        render(<TestHarness uid="test-uid" />);

        await waitFor(() => expect(screen.getByTestId('out')).not.toHaveTextContent('loading'));

        const out = screen.getByTestId('out').textContent || '';
        expect(out.split(',')).toContain('base1');
    });

    it('honors per-user transformation overrides when merging base characters', async () => {
        data.users = { base1: { transformThresholds: [9], transformAnimations: ['user.mp4'], transformTempAnimations: ['user-temp.mp4'] } };
        const { result } = renderHook(() => useCharacterLoader('test-uid'));
        await waitFor(() => expect(result.current.loaded).toBe(true));
        expect(result.current.userCharacters.base1).toMatchObject({
            transformThresholds: [9], transformAnimations: ['user.mp4'], transformTempAnimations: ['user-temp.mp4'],
        });
        data.users = {};
    });
});
