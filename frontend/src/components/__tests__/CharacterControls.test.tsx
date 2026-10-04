import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

import CharacterControls from '../CharacterControls';
import { getCharactersInPickerOrder } from '../../utils/characterPicker';

vi.mock('../../utils/adminConfig', () => ({ isAdmin: () => false }));
vi.mock('../../services/characterService', () => ({
    addUserCharacter: vi.fn(),
    getUserCharacter: vi.fn(),
}));

describe('CharacterControls', () => {
    it('sorts characters alphabetically within each dropdown group', () => {
        const userCharacters = {
            ungroupedZ: { id: 'ungroupedZ', name: 'Zulu' },
            groupedZ: { id: 'groupedZ', name: 'Zelda', characterGroup: 'Team' },
            ungroupedA: { id: 'ungroupedA', name: 'Alpha' },
            groupedA: { id: 'groupedA', name: 'Astra', characterGroup: 'Team' },
            playerName: { id: 'playerName', name: 'Hidden Name', playerName: 'Beta' },
        };

        expect(getCharactersInPickerOrder(userCharacters).map(character => character.id)).toEqual([
            'ungroupedA',
            'playerName',
            'ungroupedZ',
            'groupedA',
            'groupedZ',
        ]);

        const { container } = render(
            <CharacterControls
                uid={null}
                userCharacters={userCharacters}
                selectedId={null}
                setSelectedId={vi.fn()}
                setUserCharacters={vi.fn()}
                animationUrl=""
                onCycle={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(Array.from(select.querySelectorAll(':scope > option')).map(option => option.textContent)).toEqual([
            'Select...',
            'Alpha',
            'Beta',
            'Zulu',
        ]);

        const groupedOptions = container.querySelector('optgroup[label="Team"]')?.querySelectorAll('option');
        expect(Array.from(groupedOptions ?? []).map(option => option.textContent?.trim())).toEqual(['Astra', 'Zelda']);
    });
});