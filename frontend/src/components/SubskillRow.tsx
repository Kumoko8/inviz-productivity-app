import React, { useState, useEffect, useRef } from "react";
import { xpThreshold } from "../utils/xpUtils";

// color mapping for `data`/`amount` types (copied from SkillItem)
const dataColor = (p: number) => {
    if (p < 30) return '#8b0000';
    if (p < 50) return '#ff0000';
    if (p < 65) return '#ff8c00';
    if (p < 80) return '#ffd700';
    if (p < 90) return '#22c55e';
    return '#06b6d4';
};

/** Parse "17/25" → {value:17, target:25}. Plain number → /100. */
const parseFraction = (input: string): { value: number; target: number } | null => {
    const trimmed = input.trim();
    const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (match) return { value: parseFloat(match[1]), target: parseFloat(match[2]) };
    const plain = parseFloat(trimmed);
    if (!isNaN(plain)) return { value: plain, target: 100 };
    return null;
};

const SubskillRow: React.FC<{
    ss: any;
    parentType?: string;
    onUpdate: (u: any) => void;
    onDelete: () => void;
    uid?: string | null;
    characterXp?: number;
    characterLevel?: number;
    onAwardXp?: (xp: number) => void;
    forceClaimed?: boolean;
}> = ({ ss, parentType, onUpdate, onDelete, uid, characterXp = 0, characterLevel = 1, onAwardXp, forceClaimed = false }) => {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(ss?.name || "");
    const [dataValue, setDataValue] = useState<number>(ss?.progress || 0);
    const [displayProg, setDisplayProg] = useState<number>(ss?.progress || 0);
    const [fractionEditing, setFractionEditing] = useState(false);
    const [fractionInput, setFractionInput] = useState<string>(
        ss?.amountTarget !== undefined ? `${ss.amountValue ?? 0}/${ss.amountTarget}` : ''
    );
    const [confirmDelete, setConfirmDelete] = useState(false);
    const confirmRef = useRef<HTMLDivElement>(null);
    const [claimed, setClaimed] = useState(!!(ss as any).xpClaimedAt);
    const [showChildren, setShowChildren] = useState(true);

    // Mini XP popup
    const [xpPopup, setXpPopup] = useState<{
        awarded: number; level: number; fill: number; targetFill: number; leveledUp: boolean;
    } | null>(null);
    const popupTimers = useRef<number[]>([]);

    // Recursively stamp xpClaimedAt on all nested subskills to prevent double-counting
    const markAllClaimed = (nodes: any[], claimedAt: number): any[] =>
        nodes.map((n: any) => ({
            ...n,
            xpClaimedAt: claimedAt,
            subskills: markAllClaimed(n.subskills ?? [], claimedAt),
        }));

    const handleComplete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (claimed || forceClaimed || !onAwardXp) return;
        const countActive = (nodes: any[]): number =>
            nodes.reduce((acc: number, n: any) => acc + ((n.progress ?? 0) > 0 ? 1 : 0) + countActive(n.subskills ?? []), 0);
        const activeSubs = countActive(ss.subskills ?? []);
        const prog = displayProg;
        const awarded = prog > 0 ? Math.round(prog) + (1 + activeSubs) * 25 + (ss.levelCount ?? 1) ** 2 : 0;
        if (awarded === 0) return;
        const beforeFill = (characterXp / xpThreshold(characterLevel)) * 100;
        let tmpXp = characterXp + awarded;
        let tmpLevel = characterLevel;
        while (tmpXp >= xpThreshold(tmpLevel)) { tmpXp -= xpThreshold(tmpLevel); tmpLevel++; }
        const afterFill = (tmpXp / xpThreshold(tmpLevel)) * 100;
        const leveledUp = tmpLevel > characterLevel;
        popupTimers.current.forEach(t => clearTimeout(t));
        popupTimers.current = [];
        setXpPopup({ awarded, level: characterLevel, fill: beforeFill, targetFill: afterFill, leveledUp });
        popupTimers.current.push(window.setTimeout(() => setXpPopup(p => p ? { ...p, fill: p.targetFill } : null), 60));
        popupTimers.current.push(window.setTimeout(() => setXpPopup(null), 3000));
        // Grey out immediately — also stamp all nested subskills
        setClaimed(true);
        const claimedAt = Date.now();
        const updatedSubskills = markAllClaimed(ss.subskills ?? [], claimedAt);
        onUpdate({ xpClaimedAt: claimedAt, ...(updatedSubskills.length > 0 ? { subskills: updatedSubskills } : {}) });
        onAwardXp(awarded);
    };

    useEffect(() => {
        setLocal(ss?.name || "");
        setDataValue(ss?.progress || 0);
        setDisplayProg(ss?.progress || 0);
        if (ss?.amountTarget !== undefined) {
            setFractionInput(`${ss.amountValue ?? 0}/${ss.amountTarget}`);
        }
    }, [ss]);

    // Sync claimed state ONLY when xpClaimedAt's actual value changes — not on every ss object reference change.
    // This prevents sibling additions (which create new ss object references) from accidentally resetting claimed.
    const ssXpClaimedAt = (ss as any).xpClaimedAt;
    useEffect(() => {
        if (ssXpClaimedAt) setClaimed(true);
        else setClaimed(false);
    }, [ssXpClaimedAt]);

    const commitFraction = () => {
        if (!fractionInput.trim()) {
            onUpdate({ amountValue: undefined, amountTarget: undefined });
            setFractionEditing(false);
            return;
        }
        const parsed = parseFraction(fractionInput);
        if (parsed) {
            const { value, target } = parsed;
            const pct = target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 0;
            onUpdate({ progress: pct, amountValue: value, amountTarget: target, mastered: pct >= 100, updatedAt: Date.now() });
            setDataValue(pct);
            setDisplayProg(pct);
        }
        setFractionEditing(false);
    };

    const addNested = (e?: React.MouseEvent) => {
        e && e.stopPropagation();
        const newSub: any = { id: `sub_${Date.now()}`, name: 'New Subskill', progress: 0 };
        const next = Array.isArray(ss.subskills) ? [newSub, ...ss.subskills] : [newSub];
        // recompute this subskill's progress as average of its (new) children
        const avg = Math.round(next.reduce((sum: number, c: any) => sum + (typeof c.progress === 'number' ? c.progress : 0), 0) / next.length);
        setDisplayProg(avg);
        setDataValue(avg);
        // Reactivate this parent's Complete button — new unclaimed child means XP can be claimed again
        setClaimed(false);
        onUpdate({ subskills: next, progress: avg, mastered: avg >= 100, xpClaimedAt: undefined });
    };

    const prog = Math.min(100, displayProg);
    const barColor = parentType === 'data' ? dataColor(prog) : '#22c55e';
    const fractionDisplay = fractionInput.trim() ? fractionInput.trim() : 'Set score';

    return (
        <div className="w-full relative">
            {/* Mini XP popup */}
            {xpPopup && (
                <div className="absolute bottom-full left-0 right-0 mb-1 z-20 bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 pointer-events-none">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-amber-600">+{xpPopup.awarded} XP</span>
                        {xpPopup.leveledUp && <span className="text-xs font-bold text-emerald-500">⬆ Level Up!</span>}
                        <span className="text-xs text-gray-400">Lv {characterLevel}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                        <div className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out" style={{ width: `${Math.min(100, xpPopup.fill)}%` }} />
                    </div>
                </div>
            )}
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    {editing ? (
                        <input value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => { setEditing(false); if (local !== ss.name) onUpdate({ name: local }); }} className="w-full border rounded px-2 py-1 text-sm" />
                    ) : (
                        <div className="min-w-0">
                            <div onClick={() => setEditing(true)} className="text-sm font-medium break-words cursor-pointer inline-block border border-transparent hover:border-cyan-300 rounded px-1 lg:border-0 lg:px-0">{ss.name}</div>
                            {(ss.levelCount && ss.levelCount >= 2) && (
                                <span className="ml-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 align-middle">Lv {ss.levelCount}</span>
                            )}
                            {(ss.updatedAt || ss.createdAt) && (
                                <span className="ml-1 text-[10px] text-gray-400">updated: {new Date(ss.updatedAt ?? ss.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                            )}
                            <div className="mt-1 text-xs text-gray-600">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input type="number" list="subskill-prog-presets" value={String(dataValue)} onChange={(e) => setDataValue(Number(e.target.value))} onBlur={() => { const v = Math.max(0, Math.min(100, Math.floor(dataValue))); onUpdate({ progress: v, mastered: v >= 100, amountTarget: undefined, amountValue: undefined, updatedAt: Date.now() }); setDisplayProg(v); setFractionInput(''); setFractionEditing(false); }} className="w-16 border rounded px-1 py-0.5 text-xs" />
                                    <datalist id="subskill-prog-presets"><option value="50" /><option value="100" /></datalist>
                                    {fractionEditing ? (
                                        <input
                                            type="text"
                                            value={fractionInput}
                                            placeholder="17/25"
                                            autoFocus
                                            onChange={(e) => setFractionInput(e.target.value)}
                                            onBlur={commitFraction}
                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            className="w-24 border rounded px-1 py-0.5 text-xs"
                                        />
                                    ) : (
                                        <button onClick={() => setFractionEditing(true)} className="text-xs text-blue-500 hover:underline">
                                            {fractionDisplay}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* progress bar inline on large screens only */}
                    <div className="hidden lg:block w-24 h-2 bg-gray-200 rounded overflow-hidden" style={{ marginRight: 6 }}>
                        <div className="h-2 transition-all duration-700 ease-out" style={{ width: `${prog}%`, backgroundColor: barColor }} />
                    </div>

                    <button onClick={(e) => addNested(e)} className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px] sm:text-xs">+</button>
                    {Array.isArray(ss.subskills) && ss.subskills.length > 0 && (
                        <button
                            onClick={e => { e.stopPropagation(); setShowChildren(v => !v); }}
                            aria-label={showChildren ? 'Collapse children' : 'Expand children'}
                            className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] sm:text-xs text-gray-500 hover:text-gray-800"
                        >{showChildren ? '▼' : '▶'}</button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                        aria-label="Remove subskill"
                        className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] sm:text-xs"
                    >✕</button>
                </div>
            </div>

            {/* Delete confirmation modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(false)}>
                    <div ref={confirmRef} className="bg-white rounded-xl shadow-xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <p className="text-sm font-semibold mb-1">Delete subskill?</p>
                        <p className="text-xs text-gray-500 mb-4">"{ss.name}" will be permanently removed.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => { setConfirmDelete(false); onDelete(); }} className="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* progress bar full-width stacked underneath on small/medium screens */}
            <div className="mt-1 w-full h-2 bg-gray-200 rounded overflow-hidden lg:hidden">
                <div className="h-2 transition-all duration-700 ease-out" style={{ width: `${prog}%`, backgroundColor: barColor }} />
            </div>

            {/* Complete button — same XP formula as top-level */}
            <button
                onClick={handleComplete}
                disabled={claimed || forceClaimed || displayProg === 0}
                title={claimed || forceClaimed ? 'XP already claimed' : (() => {
                    const countActive = (nodes: any[]): number =>
                        nodes.reduce((acc: number, n: any) => acc + ((n.progress ?? 0) > 0 ? 1 : 0) + countActive(n.subskills ?? []), 0);
                    const activeSubs = countActive(ss.subskills ?? []);
                    const xp = displayProg > 0 ? Math.round(displayProg) + (1 + activeSubs) * 25 + (ss.levelCount ?? 1) ** 2 : 0;
                    return `Complete — earn ${xp} XP`;
                })()}
                className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${claimed || forceClaimed || displayProg === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-fuchsia-500 hover:bg-fuchsia-600 text-white'
                    }`}
            >
                Complete
            </button>

            {Array.isArray(ss.subskills) && ss.subskills.length > 0 && showChildren && (
                <div className="mt-2 ml-4 flex flex-col gap-2">
                    {ss.subskills.map((n: any) => (
                        <div key={n.id} className="p-2 border rounded" style={{ backgroundColor: parentType === 'list' ? (n.color || '#f8fafc') : '#ffffff' }}>
                            <SubskillRow ss={n} parentType={parentType} onUpdate={(u) => {
                                const next = (ss.subskills || []).map((s: any) => s.id === n.id ? { ...s, ...u } : s);
                                // recompute this subskill's progress as average of its children
                                const avg = Math.round(next.reduce((sum: number, c: any) => sum + (typeof c.progress === 'number' ? c.progress : 0), 0) / next.length);
                                setDisplayProg(avg);
                                setDataValue(avg);
                                onUpdate({ subskills: next, progress: avg, mastered: avg >= 100 });
                            }} onDelete={() => {
                                const next = (ss.subskills || []).filter((s: any) => s.id !== n.id);
                                if (next.length === 0) {
                                    onUpdate({ subskills: next });
                                } else {
                                    const avg = Math.round(next.reduce((sum: number, c: any) => sum + (typeof c.progress === 'number' ? c.progress : 0), 0) / next.length);
                                    setDisplayProg(avg);
                                    setDataValue(avg);
                                    onUpdate({ subskills: next, progress: avg, mastered: avg >= 100 });
                                }
                            }}
                                uid={uid}
                                characterXp={characterXp}
                                characterLevel={characterLevel}
                                onAwardXp={onAwardXp}
                                forceClaimed={claimed || forceClaimed}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Level Up button — appears when this section is complete */}
            {(() => {
                const isLeaf = !Array.isArray(ss.subskills) || ss.subskills.length === 0;
                const sectionComplete = isLeaf
                    ? displayProg >= 100
                    : (ss.subskills as any[]).every((c: any) => (c.progress ?? 0) >= 100);
                if (!sectionComplete) return null;

                const handleSubLevelUp = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    // Recursively clear xpClaimedAt on all nodes so Complete becomes clickable again
                    const clearClaimed = (nodes: any[]): any[] =>
                        nodes.map((n: any) => ({ ...n, xpClaimedAt: undefined, subskills: clearClaimed(n.subskills ?? []) }));
                    setClaimed(false);
                    if (isLeaf) {
                        const newLevel = (ss.levelCount ?? 1) + 1;
                        setDisplayProg(0);
                        setDataValue(0);
                        setFractionInput('');
                        onUpdate({ progress: 0, levelCount: newLevel, mastered: false, amountValue: undefined, amountTarget: undefined, xpClaimedAt: undefined });
                    } else {
                        // Reset all leaf descendants recursively, incrementing each leaf's levelCount
                        const resetLeaves = (nodes: any[]): any[] => nodes.map((n: any) => {
                            if (!Array.isArray(n.subskills) || n.subskills.length === 0) {
                                return { ...n, progress: 0, levelCount: (n.levelCount ?? 1) + 1, mastered: false, xpClaimedAt: undefined };
                            }
                            return { ...n, xpClaimedAt: undefined, subskills: resetLeaves(n.subskills ?? []) };
                        });
                        const newChildren = resetLeaves(ss.subskills ?? []);
                        setDisplayProg(0);
                        setDataValue(0);
                        onUpdate({ subskills: newChildren, progress: 0, mastered: false, xpClaimedAt: undefined });
                    }
                };

                return (
                    <button
                        onClick={handleSubLevelUp}
                        className="mt-2 w-full px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium transition-colors"
                    >
                        ⬆ Level Up
                    </button>
                );
            })()}
        </div>
    );
};

export default SubskillRow;
