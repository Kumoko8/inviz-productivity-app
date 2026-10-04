import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the characterService and userService before importing the hook
vi.mock('../../services/characterService', () => ({
    getCharacters: async () => [{ id: 'base1', name: 'Base One', animation: '' }],
    getUserCharacters: async (uid: string) => ({}),
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
});
