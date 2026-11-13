import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    collection: vi.fn(),
    getDocs: vi.fn(),
    getDrawings: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
}));

vi.mock('../../firebase', () => ({ auth: { currentUser: { uid: 'test-uid' } }, db: {} }));
vi.mock('firebase/firestore', () => ({ collection: mocks.collection, getDocs: mocks.getDocs }));
vi.mock('../../services/drawingService', () => ({
    getDrawings: mocks.getDrawings,
    deleteDrawing: vi.fn(),
}));
vi.mock('../../services/characterService', () => ({
    addItemToCharacter: mocks.addItem,
    updateItemForCharacter: mocks.updateItem,
    deleteItemFromCharacter: mocks.deleteItem,
}));

import PrayerBubble from '../PrayerBubble';

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocs.mockResolvedValue({ docs: [] });
    mocks.getDrawings.mockResolvedValue([]);
    mocks.addItem.mockResolvedValue('new-id');
    mocks.updateItem.mockResolvedValue(undefined);
    mocks.deleteItem.mockResolvedValue(undefined);
});
afterEach(cleanup);

function openPrayers() {
    fireEvent.click(screen.getByRole('button', { name: /show prayers/i }));
}

describe('PrayerBubble', () => {
    it('adds a prayer and displays it only after a matching search', async () => {
        render(<PrayerBubble characterId="char1" />);
        openPrayers();
        await waitFor(() => expect(mocks.getDocs).toHaveBeenCalled());
        expect(mocks.collection).toHaveBeenCalledWith(expect.anything(), 'users', 'test-uid', 'characters', 'char1', 'prayers');
        expect(mocks.getDrawings).toHaveBeenCalledWith('test-uid', 'char1');

        fireEvent.change(screen.getByPlaceholderText('Enter prayer...'), { target: { value: 'Please help' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        await waitFor(() => expect(mocks.addItem).toHaveBeenCalledWith(
            'test-uid', 'char1', 'prayers', { text: 'Please help', color: '#bde0fe' },
        ));
        expect(screen.queryByText('Please help')).not.toBeInTheDocument();
        expect(screen.getByText('Search by word or date to see prayers.')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Search keyword'), { target: { value: 'help' } });
        expect(await screen.findByText('Please help')).toBeInTheDocument();
    });

    it('updates the color of a matching prayer', async () => {
        mocks.getDocs.mockResolvedValue({
            docs: [{ id: 'p1', data: () => ({ text: 'Hello', color: '#ff0000' }) }],
        });
        render(<PrayerBubble characterId="char1" />);
        openPrayers();
        fireEvent.change(screen.getByLabelText('Search keyword'), { target: { value: 'hello' } });
        await screen.findByText('Hello');

        fireEvent.change(screen.getByLabelText('Set color for prayers'), { target: { value: '#00ff00' } });
        await waitFor(() => expect(mocks.updateItem).toHaveBeenCalledWith(
            'test-uid', 'char1', 'prayers', 'p1', { color: '#00ff00' },
        ));
        expect(screen.getByLabelText('Set color for prayers')).toHaveValue('#00ff00');
    });

    it('deletes a matching prayer using the character subcollection service', async () => {
        mocks.getDocs.mockResolvedValue({
            docs: [{ id: 'p2', data: () => ({ text: 'To delete', color: '#ffffff' }) }],
        });
        render(<PrayerBubble characterId="char1" />);
        openPrayers();
        fireEvent.change(screen.getByLabelText('Search keyword'), { target: { value: 'delete' } });
        await screen.findByText('To delete');

        fireEvent.click(screen.getByRole('button', { name: '✕' }));
        await waitFor(() => expect(mocks.deleteItem).toHaveBeenCalledWith('test-uid', 'char1', 'prayers', 'p2'));
        expect(screen.queryByText('To delete')).not.toBeInTheDocument();
        expect(screen.getByText('No matching prayers.')).toBeInTheDocument();
    });
});
