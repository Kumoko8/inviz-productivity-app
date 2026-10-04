import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock characterData to a small set for deterministic behavior
vi.mock('../../components/CharacterData', () => ({
    characterData: [{ name: 'TestChar', animation: 'characters/test.mp4' }],
}));

// Mock firebase/storage functions: ref returns the path, getDownloadURL returns a CDN url
vi.mock('firebase/storage', () => ({
    ref: (storage: any, path: string) => path,
    getDownloadURL: async (p: string) => `https://cdn/${p}`,
}));

// Mock ../firebase to provide a storage placeholder (not actually used by our mocks)
vi.mock('../../firebase', () => ({ storage: {} }));

import usePreviewLoader from '../usePreviewLoader';

const TestHarness: React.FC<{ names: string[] }> = ({ names }) => {
    const { urls, loading } = usePreviewLoader(names);
    return (
        <div>
            <div data-testid="loading">{loading ? '1' : '0'}</div>
            {Object.keys(urls).map((k) => (
                <div key={k} data-testid={`url-${k}`}>{urls[k]}</div>
            ))}
        </div>
    );
};

describe('usePreviewLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads preview url for known character', async () => {
        render(<TestHarness names={["TestChar"]} />);

        // wait for loading to finish and url to appear
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('0'));
        const el = screen.getByTestId('url-TestChar');
        expect(el.textContent).toContain('https://cdn/characters/test.mp4');
    });

    it('returns empty string when character not present', async () => {
        render(<TestHarness names={["Unknown"]} />);
        await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('0'));
        const el = screen.getByTestId('url-Unknown');
        expect(el.textContent).toBe('');
    });
});
