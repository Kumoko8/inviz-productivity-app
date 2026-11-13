import React, { useState } from 'react';
import {
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Character } from '../../../types/character';
import ClassMode from '../../ClassMode';

vi.mock('../../../firebase', () => ({ db: {}, storage: {} }));
vi.mock('../../../utils/storageUtils', () => ({
    fetchAnimUrl: vi.fn(async () => ''),
}));
vi.mock('../../ClassModeSkills', () => ({
    default: () => <div>Skills panel</div>,
}));
vi.mock('../../RecalculateTotalXpButton', () => ({ default: () => null }));
vi.mock('../../LevelUpOverlay', () => ({ default: () => null }));
vi.mock('../../../services/characterService', () => ({
    addUserCharacter: vi.fn(),
    getUserCharacter: vi.fn(),
    uploadCharacterStill: vi.fn(),
}));

const characters: Character[] = [
    { id: 'a', name: 'Alice', hp: 100, maxHp: 100, xp: 1, level: 2 },
    { id: 'b', name: 'Bob', hp: 50, maxHp: 100, xp: 2, level: 2 },
];

describe('ClassMode progress integration', () => {
    it('connects card controls and selected awards to the saved characters', async () => {
        const saveCharacter = vi.fn(async () => {});
        function Harness() {
            const [userCharacters, setUserCharacters] = useState<
                Record<string, Character>
            >(
                Object.fromEntries(
                    characters.map((character) => [character.id, character])
                )
            );
            return (
                <ClassMode
                    characters={characters}
                    userCharacters={userCharacters}
                    setUserCharacters={setUserCharacters}
                    saveCharacter={saveCharacter}
                    updateSkill={vi.fn()}
                    controlsDisabled={false}
                    onClose={vi.fn()}
                />
            );
        }
        render(<Harness />);
        fireEvent.click(screen.getByText('Alice'));
        const aliceCard = screen
            .getByText('Alice')
            .closest('.relative.flex.flex-col') as HTMLElement;
        fireEvent.click(within(aliceCard).getByRole('button', { name: '-' }));
        await waitFor(() =>
            expect(within(aliceCard).getByText('HP 90/100')).toBeInTheDocument()
        );
        expect(saveCharacter).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a', hp: 90 })
        );

        fireEvent.change(screen.getByPlaceholderText('XP'), {
            target: { value: '2' },
        });
        fireEvent.click(
            screen.getByRole('button', { name: /award xp to selected \(1\)/i })
        );
        await waitFor(() =>
            expect(within(aliceCard).getByText('3/8 XP')).toBeInTheDocument()
        );
        expect(saveCharacter).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a', xp: 3 })
        );
        expect(screen.getByText('HP 50/100')).toBeInTheDocument();
    });
});
