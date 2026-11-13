import React, { useRef, useState } from 'react';
import { totalXpForLevel, xpThreshold } from '../../utils/xpUtils';

const STILL_EVENT_MS = 20000;

export type ProgressCharacter = {
    id?: string;
    hp?: number;
    maxHp?: number;
    xp?: number;
    level?: number;
    currencyXp?: number;
    characterGroup?: string;
    [field: string]: unknown;
};

type Props = {
    allChars: (ProgressCharacter & { id: string })[];
    userCharacters: Record<string, ProgressCharacter>;
    setUserCharacters: React.Dispatch<
        React.SetStateAction<Record<string, ProgressCharacter>>
    >;
    saveCharacter: (character: ProgressCharacter) => Promise<void>;
    selected: string[];
    xpAwardAmount: string;
};

export default function useClassModeProgress({
    allChars,
    userCharacters,
    setUserCharacters,
    saveCharacter,
    selected,
    xpAwardAmount,
}: Props) {
    const [xpAnimatingFull, setXpAnimatingFull] = useState<
        Record<string, boolean>
    >({});
    const [stillEvents, setStillEvents] = useState<
        Record<string, 'earnXp' | 'loseHp'>
    >({});
    const stillTimers = useRef<Record<string, number>>({});
    const triggerStill = (charId: string, event: 'earnXp' | 'loseHp') => {
        setStillEvents((prev) => ({ ...prev, [charId]: event }));
        if (stillTimers.current[charId])
            window.clearTimeout(stillTimers.current[charId]);
        stillTimers.current[charId] = window.setTimeout(() => {
            setStillEvents((prev) => {
                const next = { ...prev };
                delete next[charId];
                return next;
            });
        }, STILL_EVENT_MS);
    };
    // Healing ends a lingering lose-HP image so the card goes back to default.
    const clearLoseHpStill = (charId: string) => {
        if (stillEvents[charId] !== 'loseHp') return;
        if (stillTimers.current[charId])
            window.clearTimeout(stillTimers.current[charId]);
        setStillEvents((prev) => {
            const next = { ...prev };
            delete next[charId];
            return next;
        });
    };
    React.useEffect(
        () => () => {
            Object.values(stillTimers.current).forEach((t) =>
                window.clearTimeout(t)
            );
        },
        []
    );
    const [xpLevelToast, setXpLevelToast] = useState<Record<string, boolean>>(
        {}
    );
    const xpAnimTimeouts = useRef<Record<string, number[]>>({});
    const [xpAwardConfirm, setXpAwardConfirm] = useState<{
        amount: number;
        count: number;
    } | null>(null);
    const xpAwardConfirmTimeout = useRef<number | null>(null);
    const [hpAwardConfirm, setHpAwardConfirm] = useState<string | null>(null);
    const hpAwardConfirmTimeout = useRef<number | null>(null);
    // cleanup XP animation timeouts on unmount
    React.useEffect(() => {
        return () => {
            for (const key of Object.keys(xpAnimTimeouts.current)) {
                for (const t of xpAnimTimeouts.current[key] || [])
                    window.clearTimeout(t);
            }
            if (xpAwardConfirmTimeout.current !== null)
                window.clearTimeout(xpAwardConfirmTimeout.current);
            if (hpAwardConfirmTimeout.current !== null)
                window.clearTimeout(hpAwardConfirmTimeout.current);
        };
    }, []);

    const changeHp = async (charId: string, delta: number) => {
        const ch: ProgressCharacter =
            allChars.find((x) => x.id === charId) ?? {};
        const uc = userCharacters[charId] ?? ch ?? {};
        const curHp = typeof uc.hp === 'number' ? uc.hp : (ch.hp ?? 100);
        const maxHp =
            typeof uc.maxHp === 'number' ? uc.maxHp : (ch.maxHp ?? 100);
        const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
        if (newHp < curHp) triggerStill(charId, 'loseHp');
        else if (newHp > curHp) clearLoseHpStill(charId);
        const updated = { ...uc, hp: newHp };
        setUserCharacters((prev) => ({ ...prev, [charId]: updated }));
        try {
            await saveCharacter(updated);
        } catch (e) {
            console.error(e);
        }
    };

    // Used by TrainingMode to persist HP damage (absolute value, not delta)
    const setCharHp = async (charId: string, hp: number) => {
        const ch: ProgressCharacter =
            allChars.find((x) => x.id === charId) ?? {};
        const uc = userCharacters[charId] ?? ch ?? {};
        const prevHp = typeof uc.hp === 'number' ? uc.hp : (ch.hp ?? 100);
        if (hp < prevHp) triggerStill(charId, 'loseHp');
        else if (hp > prevHp) clearLoseHpStill(charId);
        const updated = { ...uc, hp };
        setUserCharacters((prev) => ({ ...prev, [charId]: updated }));
        try {
            await saveCharacter(updated);
        } catch (e) {
            console.error(e);
        }
    };

    // change XP with level-up animation when crossing thresholds
    const awardXpToSelected = () => {
        const amount = Math.trunc(Number(xpAwardAmount));
        if (selected.length === 0 || !Number.isFinite(amount) || amount === 0)
            return;
        for (const charId of selected) changeXp(charId, amount);
        if (xpAwardConfirmTimeout.current)
            window.clearTimeout(xpAwardConfirmTimeout.current);
        setXpAwardConfirm({ amount, count: selected.length });
        xpAwardConfirmTimeout.current = window.setTimeout(
            () => setXpAwardConfirm(null),
            3000
        );
    };

    const awardXpToGroup = (group: string, points: number) => {
        const ids = allChars
            .filter(
                (c) =>
                    (userCharacters[c.id]?.characterGroup || '').trim() ===
                    group
            )
            .map((c) => c.id);
        for (const id of ids) changeXp(id, points);
    };

    const changeHpForSelected = (delta: number) => {
        if (selected.length === 0) return;
        const boundaryHp = delta < 0 ? 0 : 100;
        const eligibleCharacterIds = selected.filter((charId) => {
            const ch: ProgressCharacter =
                allChars.find((character) => character.id === charId) ?? {};
            const uc = userCharacters[charId] ?? ch;
            const hp = typeof uc.hp === 'number' ? uc.hp : (ch.hp ?? 100);
            const maxHp =
                typeof uc.maxHp === 'number' ? uc.maxHp : (ch.maxHp ?? 100);
            return delta < 0 ? hp > 0 : hp < maxHp;
        });
        const cappedCount = selected.length - eligibleCharacterIds.length;

        for (const charId of eligibleCharacterIds) changeHp(charId, delta);

        const changedCount = eligibleCharacterIds.length;
        const action = delta < 0 ? 'subtracted from' : 'added to';
        const changedMessage =
            changedCount > 0
                ? `${Math.abs(delta)} HP ${action} ${changedCount} character${changedCount !== 1 ? 's' : ''}.`
                : '';
        const cappedMessage =
            cappedCount > 0
                ? `${cappedCount} character${cappedCount !== 1 ? 's' : ''} already ${cappedCount === 1 ? 'has' : 'have'} ${boundaryHp} HP.`
                : '';

        if (hpAwardConfirmTimeout.current)
            window.clearTimeout(hpAwardConfirmTimeout.current);
        setHpAwardConfirm(
            [cappedMessage, changedMessage].filter(Boolean).join(' ')
        );
        hpAwardConfirmTimeout.current = window.setTimeout(
            () => setHpAwardConfirm(null),
            3000
        );
    };

    const changeXp = async (charId: string, delta: number) => {
        const ch: ProgressCharacter =
            allChars.find((x) => x.id === charId) ?? {};
        const uc = userCharacters[charId] ?? ch ?? {};
        const curXp = typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0);
        const curLevel =
            typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
        // keep spendable currencyXp (store balance) in sync with every XP award
        const existingCurrency =
            typeof uc.currencyXp === 'number'
                ? Math.max(0, Math.floor(uc.currencyXp))
                : totalXpForLevel(curLevel, curXp);
        const newCurrency = existingCurrency + delta;
        if (delta > 0) triggerStill(charId, 'earnXp');
        const tmpXp = curXp + delta;
        const tmpLevel = curLevel;
        const nextXP = xpThreshold(tmpLevel);
        // detect if we will level up
        if (tmpXp < nextXP) {
            // simple update, no animation
            const updated = {
                ...uc,
                xp: tmpXp,
                level: tmpLevel,
                currencyXp: newCurrency,
            };
            setUserCharacters((prev) => ({ ...prev, [charId]: updated }));
            try {
                await saveCharacter(updated);
            } catch (e) {
                console.error(e);
            }
            return;
        }

        // compute leftovers for each level-up step
        const leftovers: number[] = [];
        let tXp = tmpXp;
        let tLvl = tmpLevel;
        while (tXp >= xpThreshold(tLvl)) {
            const threshold = xpThreshold(tLvl);
            const leftover = tXp - threshold;
            leftovers.push(leftover);
            tXp = leftover;
            tLvl++;
        }

        // run sequential animation steps
        const fillDelay = 700; // ms to show full bar
        const betweenDelay = 300; // pause before next level fill

        // clear existing timeouts for this char
        const existing = xpAnimTimeouts.current[charId] || [];
        for (const t of existing) window.clearTimeout(t);
        xpAnimTimeouts.current[charId] = [];

        const runStep = (index: number, currentLevel: number) => {
            // animate fill to 100%
            setXpAnimatingFull((prev) => ({ ...prev, [charId]: true }));
            const t1 = window.setTimeout(async () => {
                // after showing full, advance level and set xp to leftover
                setXpAnimatingFull((prev) => ({ ...prev, [charId]: false }));
                const newLevel = currentLevel + 1;
                const newXpVal = leftovers[index];
                const updated = {
                    ...uc,
                    xp: newXpVal,
                    level: newLevel,
                    currencyXp: newCurrency,
                };
                setUserCharacters((prev) => ({ ...prev, [charId]: updated }));
                try {
                    await saveCharacter(updated);
                } catch (err) {
                    console.error(err);
                }

                // show brief level toast
                setXpLevelToast((prev) => ({ ...prev, [charId]: true }));
                const tToast = window.setTimeout(
                    () =>
                        setXpLevelToast((prev) => ({
                            ...prev,
                            [charId]: false,
                        })),
                    900
                );
                xpAnimTimeouts.current[charId].push(tToast);

                // schedule next step or finish
                if (index + 1 < leftovers.length) {
                    const tNext = window.setTimeout(
                        () => runStep(index + 1, newLevel),
                        betweenDelay
                    );
                    xpAnimTimeouts.current[charId].push(tNext);
                }
            }, fillDelay);
            xpAnimTimeouts.current[charId].push(t1);
        };

        // start sequence
        runStep(0, curLevel);
    };

    return {
        xpAnimatingFull,
        xpLevelToast,
        setXpLevelToast,
        stillEvents,
        xpAwardConfirm,
        hpAwardConfirm,
        changeHp,
        setCharHp,
        awardXpToSelected,
        awardXpToGroup,
        changeHpForSelected,
        changeXp,
    };
}
