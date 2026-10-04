import React, { useEffect, useRef, useState } from 'react';
import type { Character } from '../types/character';
import LevelUpOverlay from './LevelUpOverlay';
import XPStore from './XPStore';
import TrainingStatsModal from './TrainingStatsModal';
import { xpThreshold, totalXpForLevel } from '../utils/xpUtils';

interface Props {
    uid?: string | null;
    selectedCharacter: Character | null;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<any> | void;
    controlsDisabled?: boolean;
}

const XPPanel: React.FC<Props> = ({ uid, selectedCharacter, setUserCharacters, saveCharacter, controlsDisabled = false }) => {
    const [xpGlow, setXpGlow] = useState(false);
    const [showLevelToast, setShowLevelToast] = useState(false);
    const [showStore, setShowStore] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [animatingFull, setAnimatingFull] = useState(false);
    const prevLevelRef = useRef<number | null>(null);
    const fillTimeoutRef = useRef<number | null>(null);
    const multiAnimTimeouts = useRef<number[]>([]);

    const addXP = (amount: number) => {
        if (!selectedCharacter) return;

        const curXp = selectedCharacter.xp ?? 0;
        const curLevel = selectedCharacter.level ?? 1;
        let newXP = curXp + amount;
        let newLevel = curLevel;

        let nextXP = xpThreshold(newLevel);
        while (newXP >= nextXP) {
            newXP -= nextXP;
            newLevel++;
            nextXP = xpThreshold(newLevel);
        }

        // update spendable currencyXP as well (if present, increment; otherwise initialize from total)
        const existingCurrency = typeof (selectedCharacter as any).currencyXp === 'number'
            ? Math.max(0, Math.floor((selectedCharacter as any).currencyXp))
            : totalXpForLevel(curLevel, curXp);
        const newCurrency = existingCurrency + amount;

        // If this add causes a level-up, run sequential per-level animations
        if (newLevel > curLevel) {
            // clear any existing animation timers
            if (fillTimeoutRef.current) { window.clearTimeout(fillTimeoutRef.current); fillTimeoutRef.current = null; }
            for (const t of multiAnimTimeouts.current) window.clearTimeout(t);
            multiAnimTimeouts.current = [];

            // compute per-level leftover xp after each level-up
            const leftovers: number[] = [];
            let tmpXP = curXp + amount;
            let tmpLevel = curLevel;
            while (tmpXP >= xpThreshold(tmpLevel)) {
                const threshold = xpThreshold(tmpLevel);
                const leftover = tmpXP - threshold;
                leftovers.push(leftover);
                tmpXP = leftover;
                tmpLevel++;
            }
            const finalLevel = tmpLevel;
            const finalXP = tmpXP;

            const totalCurrency = newCurrency;

            // helper to clear all timeouts
            const clearAll = () => {
                if (fillTimeoutRef.current) { window.clearTimeout(fillTimeoutRef.current); fillTimeoutRef.current = null; }
                for (const t of multiAnimTimeouts.current) window.clearTimeout(t);
                multiAnimTimeouts.current = [];
            };

            // animate each level sequentially
            const fillDelay = 400; // ms to show full bar
            const betweenDelay = 200; // ms between increment and next fill

            const runStep = (index: number, currentLevel: number, currentXpValue: number) => {
                if (!selectedCharacter) return;
                if (index >= leftovers.length) {
                    // finished all levels — ensure final persisted state
                    const updatedFinal = { ...selectedCharacter, xp: finalXP, level: finalLevel, currencyXp: totalCurrency } as any;
                    setUserCharacters((prev) => ({ ...prev, [updatedFinal.id]: updatedFinal }));
                    try { saveCharacter(updatedFinal); } catch (err) { console.error(err); }
                    return;
                }

                // animate fill to 100%
                setAnimatingFull(true);
                const t1 = window.setTimeout(() => {
                    // after fillDelay, increment level and set xp to leftover
                    setAnimatingFull(false);
                    const newLvl = currentLevel + 1;
                    const newXpVal = leftovers[index];
                    const updated = { ...selectedCharacter, xp: newXpVal, level: newLvl, currencyXp: totalCurrency } as any;
                    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
                    try { saveCharacter(updated); } catch (err) { console.error(err); }

                    // show brief level toast
                    setShowLevelToast(true);
                    const tToast = window.setTimeout(() => setShowLevelToast(false), 900);
                    multiAnimTimeouts.current.push(tToast as unknown as number);

                    // schedule next step after a short pause
                    const tNext = window.setTimeout(() => runStep(index + 1, newLvl, newXpVal), betweenDelay);
                    multiAnimTimeouts.current.push(tNext as unknown as number);
                }, fillDelay) as unknown as number;
                multiAnimTimeouts.current.push(t1);
            };

            // start sequence
            runStep(0, curLevel, curXp);
        } else {
            const updated = { ...selectedCharacter, xp: newXP, level: newLevel, currencyXp: newCurrency } as any;
            setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
            try { saveCharacter(updated); } catch (err) { console.error(err); }
        }
    };

    const xp = selectedCharacter?.xp ?? 0;
    const level = selectedCharacter?.level ?? 1;
    const nextLevelXP = xpThreshold(level);
    const xpPercent = (xp / Math.max(1, nextLevelXP)) * 100;

    const xpColorClasses = ['xp-color-cyan', 'xp-color-yellow', 'xp-color-green', 'xp-color-magenta'];
    const xpColorClass = xpColorClasses[(Math.max(1, level) - 1) % xpColorClasses.length];

    const displayedPercent = animatingFull ? 100 : xpPercent;

    useEffect(() => {
        if (displayedPercent >= 100) {
            setXpGlow(true);
            const t = setTimeout(() => { setXpGlow(false); }, 800);
            return () => clearTimeout(t);
        }

        const prev = prevLevelRef.current;
        if (prev !== null && level > prev) {
            setXpGlow(true);
            setShowLevelToast(true);
            window.setTimeout(() => setShowLevelToast(false), 1400);
            const t = setTimeout(() => { setXpGlow(false); }, 800);
            prevLevelRef.current = level;
            return () => clearTimeout(t);
        }
        prevLevelRef.current = level;
    }, [displayedPercent, level]);

    if (!selectedCharacter) return null;

    // cleanup any pending timers on unmount
    useEffect(() => {
        return () => {
            if (fillTimeoutRef.current) window.clearTimeout(fillTimeoutRef.current);
            for (const t of multiAnimTimeouts.current) window.clearTimeout(t);
        };
    }, []);

    return (
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8 mx-auto">

            <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden mb-4 relative">
                <div className={`h-6 transition-all duration-1000 ease-out ${xpColorClass} ${xpGlow ? 'xp-glow' : ''}`} style={{ width: `${displayedPercent}%`, willChange: 'width' }} />

            </div>
            <div className="flex items-center justify-between mb-1">
                <div className="text-gray-800 font-semibold">Level: <span className="text-cyan-700">{level}</span></div>
                <div className="text-gray-800 font-semibold">XP: <span className="text-cyan-700">{animatingFull ? nextLevelXP : `${xp}/${nextLevelXP}`}</span></div>
            </div>
            <div className="flex items-center justify-between mb-4">
                <div />
                <div className="text-sm text-gray-500">Total XP: <span className="text-cyan-700 font-medium">{(() => {
                    // Prefer character's spendable XP if present, otherwise compute total from level/xp
                    const currency = (selectedCharacter as any)?.currencyXp;
                    if (typeof currency === 'number') return Math.max(0, Math.floor(currency));
                    return totalXpForLevel(level, xp);
                })()}</span></div>
            </div>

            <LevelUpOverlay show={showLevelToast} onDone={() => setShowLevelToast(false)} />

            <style>{`@keyframes dot-pop {
        0% { transform: translateY(0) scale(1); opacity: 1 }
        60% { transform: translateY(-18px) scale(1.2); opacity: 1 }
        100% { transform: translateY(-34px) scale(0.6); opacity: 0 }
      }
      .dot { display:block; width:8px; height:8px; border-radius:9999px; }
      .dot-anim { display:block; animation: dot-pop 1400ms cubic-bezier(.2,.8,.2,1) forwards; }

      /* speech bubble */
      @keyframes speech-bounce { 0% { transform: translateY(0); } 25% { transform: translateY(-8px); } 50% { transform: translateY(0); } 75% { transform: translateY(-4px); } 100% { transform: translateY(0); opacity: 1; } }
      .speech-bubble { position: relative; display: inline-block; background: white; color: black; padding: 6px 10px; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 6px 18px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; animation: speech-bounce 420ms ease-in-out 0s 3; }
      .speech-bubble::after { content: ''; position: absolute; width: 10px; height: 10px; background: white; border-left: 1px solid #e5e7eb; transform: rotate(45deg); bottom: -5px; left: 50%; margin-left: -5px; }
      `}</style>

            <div className="flex justify-between items-center gap-1">
                <div className="flex gap-1 sm:gap-4">
                    <button onClick={() => addXP(10)} className="px-2 py-0 sm:px-2 sm:py-1 text-sm sm:text-base bg-cyan-200 text-white rounded-md" disabled={controlsDisabled}>10</button>
                    <button onClick={() => addXP(50)} className="px-2 py-0 sm:px-2 sm:py-1 text-sm sm:text-base bg-cyan-400 text-white rounded-md" disabled={controlsDisabled}>50</button>
                    <button onClick={() => addXP(100)} className="px-2 py-0 sm:px-2 sm:py-1 text-sm sm:text-base bg-cyan-600 text-white rounded-md" disabled={controlsDisabled}>100</button>
                    <button onClick={() => addXP(1000)} className="px-2 py-0 sm:px-2 sm:py-1 text-xs sm:text-base bg-cyan-700 text-white rounded-md" disabled={controlsDisabled}>1K</button>
                </div>
                <div className="flex flex-shrink-0 gap-1 sm:gap-2">
                    <button onClick={() => setShowStore(true)} className="px-2 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-indigo-600 text-white rounded-md" disabled={controlsDisabled}>Store</button>
                    {uid && selectedCharacter && (
                        <button onClick={() => setShowStats(true)} className="px-2 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base bg-yellow-400 text-gray-900 font-semibold rounded-md hover:bg-yellow-300 transition" disabled={controlsDisabled}>Stats</button>
                    )}
                </div>
            </div>
            {showStore && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4" onClick={() => setShowStore(false)}>
                    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-4xl">
                        <XPStore selectedCharacter={selectedCharacter} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} controlsDisabled={controlsDisabled} />
                    </div>
                </div>
            )}
            {showStats && uid && selectedCharacter && (
                <TrainingStatsModal
                    uid={uid}
                    characterId={selectedCharacter.id}
                    characterName={selectedCharacter.playerName || selectedCharacter.name}
                    onClose={() => setShowStats(false)}
                />
            )}
        </div>
    );
};

export default XPPanel;
