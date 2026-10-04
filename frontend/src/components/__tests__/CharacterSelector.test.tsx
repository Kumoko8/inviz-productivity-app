import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import CharacterSelector from '../CharacterSelector';

describe('CharacterSelector', () => {
    const mockOnCycle = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders name and animation and calls onCycle', () => {
        const character = { id: 'base1', name: 'Hero' } as any;

        const { container } = render(
            <CharacterSelector selectedCharacter={character} animationUrl="/media/anim.mp4" onCycle={mockOnCycle} />
        );

        expect(screen.getByText('Hero')).toBeInTheDocument();

        const video = container.querySelector('video');
        expect(video).toBeTruthy();
        // JSDOM may prepend absolute origin; just assert the filename is present
        expect((video && video.getAttribute('src')) || '').toContain('anim.mp4');

        const prev = screen.getByLabelText('Previous character');
        const next = screen.getByLabelText('Next character');

        fireEvent.click(prev);
        expect(mockOnCycle).toHaveBeenCalledWith(-1);

        fireEvent.click(next);
        expect(mockOnCycle).toHaveBeenCalledWith(1);
    });

    it('does not call onCycle when controls are disabled', () => {
        const character = { id: 'base2', name: 'Other' } as any;
        const disabledMock = vi.fn();

        render(
            <CharacterSelector selectedCharacter={character} animationUrl="" onCycle={disabledMock} controlsDisabled />
        );

        const prev = screen.getByLabelText('Previous character');
        const next = screen.getByLabelText('Next character');

        fireEvent.click(prev);
        fireEvent.click(next);

        expect(disabledMock).not.toHaveBeenCalled();
    });
});
