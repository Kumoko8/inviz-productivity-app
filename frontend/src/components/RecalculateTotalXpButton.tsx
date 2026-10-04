import React, { useRef, useState } from "react";
import { totalXpForLevel } from "../utils/xpUtils";

interface Props {
    selected: string[];
    allChars: any[];
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
}

// Repairs the spendable Total XP (currencyXp) for characters whose store balance
// fell behind their level/XP after XP was awarded through a path that didn't sync
// currencyXp. Never lowers currencyXp, so it will not touch characters who have
// already spent XP at the store — only use this for characters with no purchases.
const RecalculateTotalXpButton: React.FC<Props> = ({ selected, allChars, userCharacters, setUserCharacters, saveCharacter }) => {
    const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
    const confirmTimeout = useRef<number | null>(null);

    const recalcTotalXpForSelected = async () => {
        if (selected.length === 0) return;
        const confirmed = window.confirm(
            'Recalculate Total XP for the selected characters?\n\n' +
            'This raises each character\'s store balance (Total XP) to match their current level and XP, ' +
            'but never lowers it. Only use this for characters who have NOT purchased anything from the ' +
            'XP Store yet — it cannot tell the difference between XP that was never synced and XP that was already spent.'
        );
        if (!confirmed) return;

        let fixedCount = 0;
        let skippedCount = 0;
        for (const charId of selected) {
            const ch = allChars.find((x: any) => x.id === charId) ?? {} as any;
            const uc = userCharacters[charId] ?? ch ?? {};
            const level = typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
            const xp = typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0);
            const expectedTotal = totalXpForLevel(level, xp);
            const currentCurrency = typeof uc.currencyXp === 'number' ? Math.max(0, Math.floor(uc.currencyXp)) : 0;
            if (currentCurrency >= expectedTotal) { skippedCount++; continue; }

            const updated = { ...uc, currencyXp: expectedTotal };
            setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
            try { await saveCharacter(updated); } catch (e) { console.error(e); }
            fixedCount++;
        }

        const parts: string[] = [];
        if (fixedCount > 0) parts.push(`Total XP recalculated for ${fixedCount} character${fixedCount !== 1 ? 's' : ''}.`);
        if (skippedCount > 0) parts.push(`${skippedCount} character${skippedCount !== 1 ? 's' : ''} already up to date.`);
        if (confirmTimeout.current) window.clearTimeout(confirmTimeout.current);
        setConfirmMessage(parts.join(' ') || 'No changes needed.');
        confirmTimeout.current = window.setTimeout(() => setConfirmMessage(null), 4000) as unknown as number;
    };

    return (
        <>
            <button
                onClick={recalcTotalXpForSelected}
                disabled={selected.length === 0}
                title="Only use for characters who haven't purchased from the XP Store yet"
                className="px-3 py-1 bg-purple-600 text-white rounded disabled:opacity-50"
            >
                Recalculate Total XP ({selected.length})
            </button>
            {confirmMessage !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        {confirmMessage}
                    </div>
                </div>
            )}
        </>
    );
};

export default RecalculateTotalXpButton;
