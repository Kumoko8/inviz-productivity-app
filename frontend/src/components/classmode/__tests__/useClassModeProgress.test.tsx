import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useClassModeProgress, {
    type ProgressCharacter,
} from '../useClassModeProgress';

const initial = {
    a: {
        id: 'a',
        hp: 80,
        maxHp: 100,
        xp: 2,
        level: 2,
        currencyXp: 20,
        characterGroup: 'Blue',
    },
    b: {
        id: 'b',
        hp: 0,
        maxHp: 100,
        xp: 3,
        level: 2,
        currencyXp: 30,
        characterGroup: 'Blue',
    },
    c: {
        id: 'c',
        hp: 40,
        maxHp: 50,
        xp: 1,
        level: 2,
        currencyXp: 15,
        characterGroup: 'Red',
    },
};

function setup(selected = ['a', 'b'], xpAwardAmount = '2') {
    const saveCharacter = vi.fn(async () => {});
    const result = renderHook(() => {
        const [userCharacters, setUserCharacters] =
            useState<Record<string, ProgressCharacter>>(initial);
        const progress = useClassModeProgress({
            allChars: Object.values(initial),
            userCharacters,
            setUserCharacters,
            saveCharacter,
            selected,
            xpAwardAmount,
        });
        return { ...progress, userCharacters };
    });
    return { ...result, saveCharacter };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('useClassModeProgress', () => {
    it('updates individual HP, clamps relative changes, and clears the damage still when healed', async () => {
        const { result, saveCharacter } = setup();
        await act(async () => {
            await result.current.changeHp('a', -100);
        });
        expect(result.current.userCharacters.a.hp).toBe(0);
        expect(result.current.stillEvents.a).toBe('loseHp');
        expect(saveCharacter).toHaveBeenLastCalledWith(
            expect.objectContaining({ id: 'a', hp: 0 })
        );
        await act(async () => {
            await result.current.setCharHp('a', 70);
        });
        expect(result.current.userCharacters.a.hp).toBe(70);
        expect(result.current.stillEvents.a).toBeUndefined();
        await act(async () => {
            await result.current.changeHp('a', 100);
        });
        expect(result.current.userCharacters.a.hp).toBe(100);
    });

    it('applies selected HP changes only to eligible characters', async () => {
        const { result, saveCharacter } = setup();
        await act(async () => {
            result.current.changeHpForSelected(-10);
        });
        expect(result.current.userCharacters.a.hp).toBe(70);
        expect(result.current.userCharacters.b.hp).toBe(0);
        expect(saveCharacter).toHaveBeenCalledTimes(1);
        expect(result.current.hpAwardConfirm).toContain(
            '1 character already has 0 HP'
        );
    });

    it('awards selected and group XP while preserving unrelated characters', async () => {
        const { result, saveCharacter } = setup(['a', 'b'], '2');
        await act(async () => {
            result.current.awardXpToSelected();
        });
        expect(result.current.userCharacters.a).toMatchObject({
            xp: 4,
            currencyXp: 22,
        });
        expect(result.current.userCharacters.b).toMatchObject({
            xp: 5,
            currencyXp: 32,
        });
        expect(result.current.xpAwardConfirm).toEqual({ amount: 2, count: 2 });
        expect(saveCharacter).toHaveBeenCalledTimes(2);
        await act(async () => {
            result.current.awardXpToGroup('Red', 3);
        });
        expect(result.current.userCharacters.c).toMatchObject({
            xp: 4,
            currencyXp: 18,
        });
        expect(result.current.userCharacters.a.xp).toBe(4);
    });

    it('persists each multi-level XP step after its animation', async () => {
        const { result, saveCharacter } = setup();
        await act(async () => {
            await result.current.changeXp('a', 40);
        });
        expect(result.current.xpAnimatingFull.a).toBe(true);
        expect(saveCharacter).not.toHaveBeenCalled();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(700);
        });
        expect(result.current.userCharacters.a).toMatchObject({
            level: 3,
            xp: 34,
            currencyXp: 60,
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
        });
        expect(result.current.userCharacters.a).toMatchObject({
            level: 4,
            xp: 7,
            currencyXp: 60,
        });
        expect(saveCharacter).toHaveBeenCalledTimes(2);
    });

    it('clears pending animation timers when unmounted', async () => {
        const { result, saveCharacter, unmount } = setup();
        await act(async () => {
            await result.current.changeXp('a', 40);
        });
        unmount();
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });
        expect(saveCharacter).not.toHaveBeenCalled();
    });
});
