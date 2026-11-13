import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HebrewDrop from '../HebrewDrop';
import { HEBREW_ALPHABET } from '../HebrewDropData';

vi.mock('../../../services/hebrewDropService', () => ({
    loadHebrewVocab: vi.fn(),
    saveHebrewVocab: vi.fn(),
    loadHbGoalGroups: vi.fn(),
    saveHbGoalGroups: vi.fn(),
}));

vi.mock('../hebrewdrop/HebrewGoalsPanel', () => ({
    default: () => <div>Vocabulary panel content</div>,
}));

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('HebrewDrop layout', () => {
    it.each([
        { screen: 'small', matches: true, instruction: 'Tap a letter' },
        { screen: 'large', matches: false, instruction: 'Drag letters' },
    ])('keeps the board and vocabulary in one scrollable layout on $screen screens', ({ matches, instruction }) => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })));
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fillText: vi.fn(),
        } as unknown as CanvasRenderingContext2D);
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
        vi.stubGlobal('cancelAnimationFrame', vi.fn());

        const { container } = render(<HebrewDrop onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Start Building' }));

        expect(screen.getByText(new RegExp(instruction))).toBeInTheDocument();
        for (const letter of HEBREW_ALPHABET) {
            expect(screen.getByText(letter.char)).toBeInTheDocument();
        }

        const canvas = container.querySelector('canvas')!;
        const scrollContainer = canvas.closest('.overflow-y-auto');
        expect(scrollContainer).toContainElement(screen.getByRole('button', { name: /Vocab Words/ }));
        expect(scrollContainer).not.toHaveClass('lg:overflow-hidden');
        expect(screen.getAllByText('Vocabulary panel content')).toHaveLength(1);

        const vocabToggle = screen.getByRole('button', { name: /Vocab Words/ });
        expect(vocabToggle).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(vocabToggle);
        expect(vocabToggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Vocabulary panel content')).not.toBeInTheDocument();
        fireEvent.click(vocabToggle);
        expect(screen.getByText('Vocabulary panel content')).toBeInTheDocument();
    });
});
