import { Dispatch, SetStateAction, useState } from 'react';
import { prayerPointsThreshold, xpThreshold } from '../../utils/xpUtils';

interface UsePrayerAwardOptions {
    selectedCharacter?: any;
    setUserCharacters?: Dispatch<SetStateAction<Record<string, any>>>;
    saveCharacter?: (c: any) => Promise<any> | void;
    onPrayerLevelUp?: (bonusXp: number) => void;
}

export function usePrayerAward({
    selectedCharacter,
    setUserCharacters,
    saveCharacter,
    onPrayerLevelUp,
}: UsePrayerAwardOptions) {
    const [ppLevelUp, setPpLevelUp] = useState(false);
    const [xpNotif, setXpNotif] = useState<{ amount: number; fill: number; leveledUp: boolean } | null>(null);

    const awardPrayerXP = async () => {
        if (!selectedCharacter || !setUserCharacters || !saveCharacter) return;

        const curPP    = (selectedCharacter.prayerPoints as number | undefined) ?? 0;
        const curPPLvl = (selectedCharacter.prayerLevel  as number | undefined) ?? 1;
        let newPP    = curPP + 1;
        let newPPLvl = curPPLvl;
        let didLevelUp = false;

        while (newPP >= prayerPointsThreshold(newPPLvl)) {
            newPP   -= prayerPointsThreshold(newPPLvl);
            newPPLvl++;
            didLevelUp = true;
        }

        // XP: characterLevel × prayerLevel × 5
        let newXp    = (selectedCharacter.xp    as number | undefined) ?? 0;
        let newLevel = (selectedCharacter.level as number | undefined) ?? 1;
        const prayXp = newLevel * curPPLvl * 5;
        newXp += prayXp;
        if (didLevelUp) newXp += 50 * newPPLvl;
        let xpLeveledUp = false;
        while (newXp >= xpThreshold(newLevel)) {
            newXp -= xpThreshold(newLevel);
            newLevel++;
            xpLeveledUp = true;
        }
        const xpFill = Math.round((newXp / Math.max(1, xpThreshold(newLevel))) * 100);

        const updated = {
            ...selectedCharacter,
            prayerPoints: newPP,
            prayerLevel:  newPPLvl,
            xp:    newXp,
            level: newLevel,
        };
        setUserCharacters(prev => ({ ...prev, [selectedCharacter.id]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }

        setXpNotif({ amount: prayXp, fill: xpFill, leveledUp: xpLeveledUp });
        window.setTimeout(() => setXpNotif(null), 2500);

        if (didLevelUp) {
            setPpLevelUp(true);
            window.setTimeout(() => setPpLevelUp(false), 2000);
            onPrayerLevelUp?.(50 * newPPLvl);
        }
    };

    return { ppLevelUp, xpNotif, awardPrayerXP };
}
