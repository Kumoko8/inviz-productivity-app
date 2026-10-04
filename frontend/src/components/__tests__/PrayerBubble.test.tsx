import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock firebase auth/db and firestore helpers used by PrayerBubble
vi.mock('../../firebase', () => ({
    auth: { currentUser: { uid: 'test-uid' } },
    db: {},
}));

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual('firebase/firestore');
    return {
        ...actual,
        collection: (db: any, ...rest: any[]) => mockCollection(db, ...rest),
        getDocs: (...args: any[]) => mockGetDocs(...args),
    };
});

const addPrayerMock = vi.fn();
const updatePrayerMock = vi.fn();
const deletePrayerMock = vi.fn();

vi.mock('../../services/characterService', () => ({
    addPrayerToCharacter: (...args: any[]) => addPrayerMock(...args),
    updatePrayerForCharacter: (...args: any[]) => updatePrayerMock(...args),
    deletePrayerFromCharacter: (...args: any[]) => deletePrayerMock(...args),
}));

import PrayerBubble from '../PrayerBubble';

describe('PrayerBubble', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('adds a prayer and calls addPrayerToCharacter', async () => {
        // start with no prayers
        mockGetDocs.mockResolvedValue({ docs: [] });

        render(<PrayerBubble characterId="char1" />);

        const input = screen.getByPlaceholderText('Enter prayer...');
        fireEvent.change(input, { target: { value: 'Please help' } });

        const addBtn = screen.getByText('Add Prayer');
        addPrayerMock.mockResolvedValue('new-id');

        fireEvent.click(addBtn);

        await waitFor(() => {
            expect(addPrayerMock).toHaveBeenCalledWith('test-uid', 'char1', expect.objectContaining({ text: 'Please help' }));
        });
    });

    it('renders existing prayer and updates color', async () => {
        // one existing prayer
        mockGetDocs.mockResolvedValue({ docs: [{ id: 'p1', data: () => ({ text: 'Hello', color: '#ff0000' }) }] });

        render(<PrayerBubble characterId="char1" />);

        // wait for the prayer to appear
        await waitFor(() => expect(screen.getByText('Hello')).toBeInTheDocument());

        // find the color input (there is one per prayer)
        const colorInputs = screen.getAllByLabelText('Set color for prayer');
        expect(colorInputs.length).toBeGreaterThan(0);

        // simulate color change
        fireEvent.change(colorInputs[0], { target: { value: '#00ff00' } });

        await waitFor(() => {
            expect(updatePrayerMock).toHaveBeenCalledWith('test-uid', 'char1', 'p1', { color: '#00ff00' });
        });
    });

    it('deletes a prayer when delete is clicked', async () => {
        mockGetDocs.mockResolvedValue({ docs: [{ id: 'p2', data: () => ({ text: 'To delete', color: '#fff' }) }] });

        render(<PrayerBubble characterId="char1" />);

        await waitFor(() => expect(screen.getByText('To delete')).toBeInTheDocument());

        const deleteBtn = screen.getAllByText('✕')[0];
        fireEvent.click(deleteBtn);

        await waitFor(() => {
            expect(deletePrayerMock).toHaveBeenCalledWith('test-uid', 'char1', 'p2');
        });
    });
});
