import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CharacterProgressCard from '../CharacterProgressCard';

describe('CharacterProgressCard', () => {
    it('shows progress and routes individual controls', () => {
        const onChangeHp = vi.fn();
        const onChangeXp = vi.fn();
        const onEditStill = vi.fn();
        render(
            <CharacterProgressCard
                c={{ name: 'Hero' }}
                uc={{ hp: 40, maxHp: 100, xp: 2, level: 2, currencyXp: 7 }}
                selected
                isAdmin
                stillVersion={0}
                controlsDisabled={false}
                onChangeHp={onChangeHp}
                onChangeXp={onChangeXp}
                onEditStill={onEditStill}
            />
        );
        expect(screen.getByText('HP 40/100')).toBeInTheDocument();
        expect(screen.getByText('Total XP: 7')).toBeInTheDocument();
        expect(screen.getByText('2/8 XP')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '-' }));
        fireEvent.click(screen.getByRole('button', { name: '+' }));
        fireEvent.click(screen.getByTitle('Click to add 25 XP'));
        fireEvent.click(screen.getByRole('button', { name: /edit image/i }));
        expect(onChangeHp.mock.calls).toEqual([[-10], [10]]);
        expect(onChangeXp).toHaveBeenCalledWith(25);
        expect(onEditStill).toHaveBeenCalledWith('Hero');
    });

    it('disables progress changes and hides admin controls when not allowed', () => {
        const onChangeHp = vi.fn();
        const onChangeXp = vi.fn();
        render(
            <CharacterProgressCard
                c={{}}
                uc={{}}
                selected={false}
                isAdmin={false}
                stillVersion={0}
                controlsDisabled
                onChangeHp={onChangeHp}
                onChangeXp={onChangeXp}
                onEditStill={vi.fn()}
            />
        );
        expect(screen.getByText('Click name to select')).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /edit image/i })
        ).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '-' })).toBeDisabled();
        fireEvent.click(screen.getByTitle('Click to add 25 XP'));
        expect(onChangeHp).not.toHaveBeenCalled();
        expect(onChangeXp).not.toHaveBeenCalled();
    });
});
