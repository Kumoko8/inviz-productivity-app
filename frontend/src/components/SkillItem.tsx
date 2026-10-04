import React, { useState, useEffect, useRef } from "react";
import { SkillItemProps } from "../types/character";
import SkillMenu from "./SkillMenu";
import SkillEditorMobile from "./SkillEditorMobile";
import SubskillRow from "./SubskillRow";
import { xpThreshold } from "../utils/xpUtils";

// color mapping for `data` type
const dataColor = (p: number) => {
    if (p < 30) return '#8b0000'; // dark red
    if (p < 50) return '#ff0000'; // bright red
    if (p < 65) return '#ff8c00'; // orange
    if (p < 80) return '#ffd700'; // yellow
    if (p < 90) return '#22c55e'; // green
    return '#06b6d4'; // aqua
};

/* SubskillRow extracted to ./SubskillRow.tsx */

const SkillItem: React.FC<SkillItemProps> = ({ name, notes, onSaveNote, progress = 0, subskills = [], onProgressUpdate = () => { }, onMaster = () => { }, onDelete = () => { }, onRename, onAddSubskill, onUpdateSubskill, onDeleteSubskill, onPrioritize, onColorChange, onDuplicate, onLevelUp, disabled = false, type, levelCount, elementId, onOpenMobile, amountTarget, amountValue, uid, xpClaimedAt, characterXp = 0, characterLevel = 1, onCompleteSkill, onAwardXp, createdAt }) => {
    const [showSubskills, setShowSubskills] = useState(false);
    const [showNote, setShowNote] = useState(false);
    const [noteDraft, setNoteDraft] = useState(notes ?? '');
    const [dataEditorOpen, setDataEditorOpen] = useState(false);
    const [dataValue, setDataValue] = useState<number>(progress);
    const [fractionEditing, setFractionEditing] = useState(false);
    const [fractionInput, setFractionInput] = useState<string>('');
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState(name);
    const dblClickRef = useRef<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Keep noteDraft in sync if notes prop changes from outside
    useEffect(() => { setNoteDraft(notes ?? ''); }, [notes]);

    // Mini XP popup state
    const [xpPopup, setXpPopup] = useState<{
        awarded: number; level: number; fill: number; targetFill: number; leveledUp: boolean;
    } | null>(null);
    const popupTimers = useRef<number[]>([]);

    const handleComplete = () => {
        if (xpClaimedAt || !onCompleteSkill) return;
        // Recursively count all nodes (at any depth) with progress > 0
        const countActive = (nodes: any[]): number =>
            nodes.reduce((acc, s) => {
                const self = (s.progress ?? 0) > 0 ? 1 : 0;
                return acc + self + countActive(s.subskills ?? []);
            }, 0);
        const activeSubskillCount = countActive(subskills ?? []);
        const itemCount = progress > 0 ? 1 + activeSubskillCount : 0;
        const awarded = progress > 0 ? Math.round(progress) + itemCount * 25 + (levelCount ?? 1) ** 2 : 0;
        // calculate before/after fill
        const beforeFill = (characterXp / xpThreshold(characterLevel)) * 100;
        let tmpXp = characterXp + awarded;
        let tmpLevel = characterLevel;
        while (tmpXp >= xpThreshold(tmpLevel)) { tmpXp -= xpThreshold(tmpLevel); tmpLevel++; }
        const afterFill = (tmpXp / xpThreshold(tmpLevel)) * 100;
        const leveledUp = tmpLevel > characterLevel;
        // clear any existing popup timers
        popupTimers.current.forEach(t => clearTimeout(t));
        popupTimers.current = [];
        setXpPopup({ awarded, level: characterLevel, fill: beforeFill, targetFill: afterFill, leveledUp });
        // trigger bar animation after paint
        popupTimers.current.push(window.setTimeout(() => {
            setXpPopup(p => p ? { ...p, fill: p.targetFill } : null);
        }, 60));
        // auto-dismiss after 3s
        popupTimers.current.push(window.setTimeout(() => setXpPopup(null), 3000));
        onCompleteSkill(awarded);
    };
    // Local mirror of subskill progress — updated immediately on every subskill change
    // so averaging is never computed against stale Firestore props
    const [subskillProgressMap, setSubskillProgressMap] = useState<Record<string, number>>(
        () => Object.fromEntries((subskills || []).map(s => [s.id, s.progress || 0]))
    );

    useEffect(() => setDataValue(progress), [progress]);
    useEffect(() => setNameDraft(name), [name]);
    useEffect(() => {
        if (amountTarget !== undefined) setFractionInput(`${amountValue ?? 0}/${amountTarget}`);
    }, [amountValue, amountTarget]);
    // Sync map when Firestore props arrive (adds newly created subskills too)
    useEffect(() => {
        setSubskillProgressMap(prev => {
            const next: Record<string, number> = { ...prev };
            (subskills || []).forEach(s => { if (next[s.id] === undefined) next[s.id] = s.progress || 0; });
            return next;
        });
    }, [subskills]);



    return (

        <div id={elementId} className="relative p-3 border rounded-md w-full bg-white">

            {/* Mini XP bar popup — appears above the card on Complete */}
            {xpPopup && (
                <div className="absolute bottom-full left-0 right-0 mb-1 z-20 bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 pointer-events-none">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-amber-600">+{xpPopup.awarded} XP</span>
                        {xpPopup.leveledUp && <span className="text-xs font-bold text-emerald-500">⬆ Level Up!</span>}
                        <span className="text-xs text-gray-400">Lv {characterLevel}</span>
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                        <div
                            className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, xpPopup.fill)}%` }}
                        />
                    </div>
                </div>
            )}
            <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                    {!editingName ? (
                        <div
                            className="font-semibold break-words cursor-text inline-block border border-transparent hover:border-cyan-300 rounded px-2 py-0.5 lg:border-0 lg:px-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (dblClickRef.current && (Date.now() - dblClickRef.current) < 500) {
                                    dblClickRef.current = null;
                                    return;
                                }
                                if (typeof (onOpenMobile) === 'function') { onOpenMobile(); } else { setEditingName(true); }
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                try {
                                    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 1024px)').matches) {
                                        dblClickRef.current = Date.now();
                                        setEditingName(true);
                                    }
                                } catch (err) {
                                    dblClickRef.current = Date.now();
                                    setEditingName(true);
                                }
                            }}
                        >
                            {name}
                        </div>
                    ) : (
                        <input
                            className="w-full font-semibold text-lg"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onBlur={() => { setEditingName(false); if (nameDraft !== name) onRename?.(nameDraft); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                            autoFocus
                        />
                    )}

                    {/* Level badge — appears after first level-up */}
                    {(levelCount && levelCount >= 2) && (
                        <div className="mt-0.5">
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">Lv {levelCount}</span>
                        </div>
                    )}

                    {/* Created date — always shown on top-level skill */}
                    {createdAt && (
                        <div className="mt-0.5">
                            <span className="text-[10px] text-gray-400">{new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                        </div>
                    )}

                    <div className="mt-2">
                        <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                            <div className="h-2 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, progress)}%`, backgroundColor: type === 'data' ? dataColor(progress) : '#16a34a' }} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">

                    {(() => {
                        const isLone = Array.isArray(subskills) && subskills.length === 0;
                        if ((type === 'data' || type === 'level') && isLone) {
                            const fractionText = amountTarget !== undefined
                                ? `${amountValue ?? 0}/${amountTarget} (${Math.round(progress)}%)`
                                : `${Math.round(progress)}%`;
                            const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : null;
                            return !dataEditorOpen ? (
                                <div className="flex items-center gap-1.5">
                                    {dateLabel && <span className="text-[10px] text-gray-400">{dateLabel}</span>}
                                    <button onClick={() => setDataEditorOpen(true)} className="text-xs text-gray-600">{fractionText}</button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                        type="number"
                                        list="skill-prog-presets"
                                        value={String(dataValue)}
                                        onChange={(e) => setDataValue(Number(e.target.value))}
                                        onBlur={() => { const v = Math.max(0, Math.min(100, Math.floor(dataValue))); onProgressUpdate(v, { amountTarget: undefined, amountValue: undefined }); setFractionEditing(false); setDataEditorOpen(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { const v = Math.max(0, Math.min(100, Math.floor(dataValue))); onProgressUpdate(v, { amountTarget: undefined, amountValue: undefined }); (e.target as HTMLInputElement).blur(); } }}
                                        className="w-20 border rounded px-2 py-1 text-sm"
                                    />
                                    <datalist id="skill-prog-presets"><option value="50" /><option value="100" /></datalist>
                                    {fractionEditing ? (
                                        <input
                                            type="text"
                                            value={fractionInput}
                                            placeholder="17/25"
                                            autoFocus
                                            onChange={(e) => setFractionInput(e.target.value)}
                                            onBlur={() => {
                                                const m = fractionInput.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                                                if (m) { const val = parseFloat(m[1]); const tar = parseFloat(m[2]); const pct = tar > 0 ? Math.max(0, Math.min(100, Math.round((val / tar) * 100))) : 0; onProgressUpdate(pct, { amountValue: val, amountTarget: tar }); }
                                                setFractionEditing(false); setDataEditorOpen(false);
                                            }}
                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            className="w-24 border rounded px-2 py-1 text-sm"
                                        />
                                    ) : (
                                        <button onClick={() => setFractionEditing(true)} className="text-xs text-blue-500 hover:underline">Set score</button>
                                    )}
                                </div>
                            );
                        }

                        // has subskills — show fraction+% if stored, otherwise just %
                        const fractionText = amountTarget !== undefined
                            ? `${amountValue ?? 0}/${amountTarget} (${Math.round(progress)}%)`
                            : `${Math.round(progress)}%`;
                        const dateLabel = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : null;
                        return (
                            <div className="flex items-center gap-1.5">
                                {dateLabel && <span className="text-[10px] text-gray-400">{dateLabel}</span>}
                                <div className="text-sm text-gray-600">{fractionText}</div>
                            </div>
                        );
                    })()}

                    <div>
                        <SkillMenu onPrioritize={onPrioritize} onColorChange={onColorChange} onToggleNote={() => setShowNote(n => !n)} onDuplicate={onDuplicate} disabled={disabled} skillName={name || ''} />
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    title="Delete skill"
                    aria-label="Delete skill"
                    className="text-red-600 text-sm leading-none p-1"
                >
                    ✕
                </button>
            </div>

            {/* ── Note editor ─────────────────────────────────────────────────── */}
            {showNote && (
                <div className="mt-3 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                    <textarea
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        placeholder="Add a note…"
                        rows={3}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => { setNoteDraft(notes ?? ''); setShowNote(false); }}
                            className="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                        >Cancel</button>
                        <button
                            onClick={() => { onSaveNote?.(noteDraft.trim()); setShowNote(false); }}
                            className="px-3 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600"
                        >Save</button>
                    </div>
                    {notes && (
                        <p className="text-xs text-gray-500 italic">Current: {notes}</p>
                    )}
                </div>
            )}

            <div className="mt-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="font-medium">Subskills</div>
                        <button
                                onClick={(e) => { e.stopPropagation(); handleComplete(); }}
                                disabled={!!xpClaimedAt}
                                title={xpClaimedAt ? 'XP already claimed' : (() => {
                                    const countActive = (nodes: any[]): number =>
                                        nodes.reduce((acc: number, s: any) => acc + ((s.progress ?? 0) > 0 ? 1 : 0) + countActive(s.subskills ?? []), 0);
                                    const activeSubs = countActive(subskills ?? []);
                                    const xp = progress > 0 ? Math.round(progress) + (1 + activeSubs) * 25 + (levelCount ?? 1) ** 2 : 0;
                                    return `Complete — earn ${xp} XP`;
                                })()}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${xpClaimedAt
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-fuchsia-500 hover:bg-fuchsia-600 text-white'
                                    }`}
                            >
                                Complete
                            </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); if (onAddSubskill) { onAddSubskill('New Subskill'); setShowSubskills(true); } }} className="px-2 py-1 bg-gray-100 rounded text-sm">+</button>
                        <button onClick={(e) => { e.stopPropagation(); setShowSubskills(s => !s); }} className="px-2 py-1 bg-gray-100 rounded text-sm">{showSubskills ? 'Close' : 'Open'}</button>
                    </div>
                </div>

                {showSubskills && (
                    <div className="mt-2 flex flex-col gap-2">
                        {(subskills || []).map((ss) => (
                            <div key={ss.id} className="p-2 border rounded" style={{ backgroundColor: (ss as any).color || '#f8fafc' }}>
                                <SubskillRow ss={ss} parentType={type} onUpdate={(u) => {
                                    onUpdateSubskill && onUpdateSubskill(ss.id, u);
                                    // update local map for immediate visual feedback (no onProgressUpdate —
                                    // updateSubskill already recomputes and saves the parent average)
                                    if (type === 'data' && u.progress !== undefined) {
                                        setSubskillProgressMap(prev => ({
                                            ...prev,
                                            [ss.id]: u.progress as number,
                                        }));
                                    }
                                }} onDelete={() => {
                                    onDeleteSubskill && onDeleteSubskill(ss.id);
                                    // remove from local map only — deleteSubskill in hook handles parent re-average
                                    setSubskillProgressMap(prev => {
                                        const next = { ...prev };
                                        delete next[ss.id];
                                        return next;
                                    });
                                }}
                                    uid={uid}
                                    characterXp={characterXp}
                                    characterLevel={characterLevel}
                                    onAwardXp={onAwardXp}
                                    forceClaimed={!!xpClaimedAt}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Level Up — only for lone skills (no subskills); hidden for auto-reset 'level'-type skills */}
            {(progress >= 100 && (subskills ?? []).length === 0 && type !== 'level') && (
                <div className="flex items-center justify-center mt-2">
                    <button onClick={(e) => { e.stopPropagation(); if (onLevelUp) onLevelUp(); }} className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-medium transition-colors">⬆ Level Up</button>
                </div>
            )}

            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(false)}>
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-xs w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <p className="text-sm font-semibold mb-1">Delete skill?</p>
                        <p className="text-xs text-gray-500 mb-4">"{name}" and all its subskills will be permanently removed.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                            <button onClick={() => { setConfirmDelete(false); onDelete && onDelete(); }} className="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SkillItem;
