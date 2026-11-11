import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
    getDocs: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
}));

vi.mock('../../firebase', () => ({ auth: { currentUser: { uid: 'user' } }, db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    getDocs: mocks.getDocs,
}));
vi.mock('../../services/characterService', () => ({
    addItemToCharacter: mocks.addItem,
    updateItemForCharacter: mocks.updateItem,
    deleteItemFromCharacter: mocks.deleteItem,
}));

import MessageList from '../MessageList';

const early = new Date(2026, 3, 10, 9, 15).getTime();
const later = new Date(2026, 3, 10, 16, 30).getTime();
const nextDay = new Date(2026, 3, 11, 8, 0).getTime();
const docs = [
    { id: 'early', data: () => ({ text: 'Family early', color: '#ffffff', createdAt: early }) },
    { id: 'missing', data: () => ({ text: 'Family undated', color: '#ffffff' }) },
    { id: 'next', data: () => ({ text: 'Family next day', color: '#ffffff', createdAt: nextDay }) },
    { id: 'later', data: () => ({ text: 'Family later', color: '#ffffff', createdAt: { toMillis: () => later } }) },
    { id: 'other', data: () => ({ text: 'Work prayer', color: '#ffffff', createdAt: later }) },
];

beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDocs.mockResolvedValue({ docs });
    mocks.addItem.mockResolvedValue('new-id');
    mocks.updateItem.mockResolvedValue(undefined);
    mocks.deleteItem.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('dashboard prayer search', () => {
    const renderPrayers = () => {
        render(<MessageList characterId="character" collectionName="prayers" title="Prayers" searchOnly />);
        fireEvent.click(screen.getByRole('button', { name: /show prayers/i }));
    };

    it('shows no prayer cards until a word search and hides them after clearing', async () => {
        renderPrayers();
        await waitFor(() => expect(screen.getByRole('button', { name: /hide prayers/i })).toBeInTheDocument());
        expect(screen.getByText('Search by word or date to see prayers.')).toBeInTheDocument();
        expect(screen.queryByText('Family early')).not.toBeInTheDocument();
        const search = screen.getByPlaceholderText('Search prayers by word or date...');
        fireEvent.change(search, { target: { value: '  FAMILY  ' } });
        await screen.findByText('Family early');
        const cards = screen.getAllByLabelText('Toggle more').map(button => button.closest('.shadow')!);
        expect(cards.map(card => within(card as HTMLElement).getByTitle(/Family/).textContent)).toEqual([
            'Family next day', 'Family later', 'Family early', 'Family undated',
        ]);
        expect(screen.queryByText('Work prayer')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Clear', { selector: 'button.sm\\:w-auto' }));
        expect(screen.queryByText('Family early')).not.toBeInTheDocument();
        fireEvent.change(search, { target: { value: '   ' } });
        expect(screen.getByText('Search by word or date to see prayers.')).toBeInTheDocument();
    });

    it('matches date searches and sorts same-day results by time', async () => {
        renderPrayers();
        const search = screen.getByLabelText('Search keyword');
        fireEvent.change(search, { target: { value: '2026-04-10' } });
        await screen.findByText('Family later');
        const cards = screen.getAllByLabelText('Toggle more').map(button => button.closest('.shadow')!);
        expect(cards.map(card => within(card as HTMLElement).getByTitle(/Family|Work/).textContent)).toEqual([
            'Family later', 'Work prayer', 'Family early',
        ]);
        fireEvent.change(search, { target: { value: 'April 11, 2026' } });
        expect(screen.getByText('Family next day')).toBeInTheDocument();
        expect(screen.queryByText('Family early')).not.toBeInTheDocument();
        fireEvent.change(search, { target: { value: 'not found' } });
        expect(screen.getByText('No matching prayers.')).toBeInTheDocument();
    });

    it('keeps new prayers hidden without a search and allows matching results to be edited', async () => {
        renderPrayers();
        await waitFor(() => expect(mocks.getDocs).toHaveBeenCalled());
        fireEvent.change(screen.getByPlaceholderText('Enter text...'), { target: { value: 'New family prayer' } });
        fireEvent.click(screen.getByText('Add', { selector: 'button' }));
        await waitFor(() => expect(mocks.addItem).toHaveBeenCalled());
        expect(screen.queryByText('New family prayer')).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Search keyword'), { target: { value: 'New family' } });
        expect(await screen.findByText('New family prayer')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Edit'));
        fireEvent.change(screen.getByDisplayValue('New family prayer'), { target: { value: 'Updated prayer' } });
        fireEvent.click(screen.getAllByText('Save')[0]);
        await waitFor(() => expect(mocks.updateItem).toHaveBeenCalledWith(
            'user', 'character', 'prayers', 'new-id', expect.objectContaining({ text: 'Updated prayer' }),
        ));
        expect(screen.getByText('No matching prayers.')).toBeInTheDocument();
    });

    it('does not change notes, which remain visible without a search', async () => {
        render(<MessageList characterId="character" collectionName="notes" title="Notes" />);
        fireEvent.click(screen.getByRole('button', { name: /show notes/i }));
        expect(await screen.findByText('Family early')).toBeInTheDocument();
    });
});
