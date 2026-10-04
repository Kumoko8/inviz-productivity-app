import React, { useState, useRef } from "react";
import { Skill } from "../types/character";
import SubskillCreator from "./SubskillCreator";
import { xpThreshold } from "../utils/xpUtils";

interface Props {
    charId: string;
    uc: any;
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    controlsDisabled?: boolean;
    characterXp?: number;
    characterLevel?: number;
    onAwardXp?: (xp: number) => void;
}

const parseFraction = (input: string): { value: number; target: number } | null => {
    const m = input.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (m) return { value: parseFloat(m[1]), target: parseFloat(m[2]) };
    return null;
};

const getDataColor = (p: number) => {
    // thresholds: dark red, bright red, orange, yellow, green, aqua
    if (p < 30) return '#8b0000'; // dark red
    if (p < 50) return '#ff0000'; // bright red
    if (p < 65) return '#ff8c00'; // orange
    if (p < 80) return '#ffd700'; // yellow
    if (p < 90) return '#22c55e'; // green
    return '#06b6d4'; // aqua
};

const computeAverageFromSkill = (skill: any): number => {
    if (!skill) return 0;
    if (!skill.subskills || skill.subskills.length === 0) return Math.round(skill.progress ?? 0);
    const vals: number[] = skill.subskills.map((ss: any) => computeAverageFromSkill(ss));
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round(sum / vals.length);
};

const ClassModeSkills: React.FC<Props> = ({ charId, uc, userCharacters, setUserCharacters, saveCharacter, controlsDisabled, onAwardXp }) => {
    const truncateTo16 = (s: string) => {
        if (!s) return '';
        return s.length > 12 ? `${s.slice(0, 9)}...` : s;
    };
    const [editing, setEditing] = useState<Record<string, boolean>>({});
    const [editingSub, setEditingSub] = useState<Record<string, boolean>>({});
    const [subEditText, setSubEditText] = useState<Record<string, string>>({});
    const [customInputs, setCustomInputs] = useState<Record<string, number>>({});
    const skillRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [fractionInputs, setFractionInputs] = useState<Record<string, string>>({});
    const [loneEditings, setLoneEditings] = useState<Record<string, boolean>>({});
    const [loneInputValues, setLoneInputValues] = useState<Record<string, string>>({});
    // nested expand / complete state
    const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});
    const [claimedSubs, setClaimedSubs] = useState<Record<string, boolean>>({});
    const [nestedEditingSubs, setNestedEditingSubs] = useState<Record<string, boolean>>({});
    const [nestedSubEditText, setNestedSubEditText] = useState<Record<string, string>>({});
    const [nestedCustomInputs, setNestedCustomInputs] = useState<Record<string, number>>({});
    const [nestedFractionInputs, setNestedFractionInputs] = useState<Record<string, string>>({});
    const [addingNestedFor, setAddingNestedFor] = useState<string | null>(null);
    const [newNestedName, setNewNestedName] = useState('');
    const [xpPopups, setXpPopups] = useState<Record<string, { awarded: number; fill: number; targetFill: number; leveledUp: boolean } | null>>({});
    const popupTimers = useRef<Record<string, number[]>>({});
    const [numInputValues, setNumInputValues] = useState<Record<string, string>>({});
    const [confirmDeleteSkill, setConfirmDeleteSkill] = useState<{ id: string; name: string } | null>(null);

    const setSubskillDataProgress = (skillId: string, subId: string, v: number) => {
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((sub: any) => sub.id === subId ? { ...sub, progress: v, mastered: v >= 100, amountValue: undefined, amountTarget: undefined, updatedAt: Date.now() } : sub) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const setSubskillFractionProgress = (skillId: string, subId: string, pct: number, fVal: number, fTar: number) => {
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((sub: any) => sub.id === subId ? { ...sub, progress: pct, mastered: pct >= 100, amountValue: fVal, amountTarget: fTar, updatedAt: Date.now() } : sub) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const setLoneSkillProgress = (skillId: string, pct: number, fVal?: number, fTar?: number) => {
        const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, progress: pct, mastered: pct >= 100, ...(fVal !== undefined ? { amountValue: fVal, amountTarget: fTar } : { amountValue: undefined, amountTarget: undefined }) } : sk) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const trainSubskill = (skillId: string, subId: string, inc: number) => {
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((sub: any) => sub.id === subId ? { ...sub, progress: Math.min(100, (sub.progress ?? 0) + inc), mastered: ((sub.progress ?? 0) + inc) >= 100 } : sub) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    // ── helper: show XP popup for a key ─────────────────────────────────────
    const showXpPopup = (key: string, awarded: number, charXp: number, charLevel: number) => {
        const beforeFill = (charXp / xpThreshold(charLevel)) * 100;
        let tmpXp = charXp + awarded;
        let tmpLevel = charLevel;
        while (tmpXp >= xpThreshold(tmpLevel)) { tmpXp -= xpThreshold(tmpLevel); tmpLevel++; }
        const afterFill = (tmpXp / xpThreshold(tmpLevel)) * 100;
        const leveledUp = tmpLevel > charLevel;
        (popupTimers.current[key] ?? []).forEach(t => clearTimeout(t));
        popupTimers.current[key] = [];
        setXpPopups(prev => ({ ...prev, [key]: { awarded, fill: beforeFill, targetFill: afterFill, leveledUp } }));
        popupTimers.current[key].push(window.setTimeout(() => setXpPopups(prev => { const p = prev[key]; return p ? { ...prev, [key]: { ...p, fill: p.targetFill } } : prev; }), 60));
        popupTimers.current[key].push(window.setTimeout(() => setXpPopups(prev => ({ ...prev, [key]: null })), 3000));
    };

    // ── path-based helpers for arbitrary-depth nested updates ──────────────
    const updateSubByPath = (skillId: string, path: string[], update: Partial<any>) => {
        const updateNodes = (nodes: any[], p: string[]): any[] => {
            if (p.length === 1) return nodes.map(n => n.id === p[0] ? { ...n, ...update, updatedAt: Date.now() } : n);
            return nodes.map(n => n.id === p[0] ? { ...n, subskills: updateNodes(n.subskills ?? [], p.slice(1)) } : n);
        };
        const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, subskills: updateNodes(sk.subskills ?? [], path) } : sk) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const deleteSubByPath = async (skillId: string, path: string[]) => {
        const deleteInNodes = (nodes: any[], p: string[]): any[] => {
            if (p.length === 1) return nodes.filter(n => n.id !== p[0]);
            return nodes.map(n => n.id === p[0] ? { ...n, subskills: deleteInNodes(n.subskills ?? [], p.slice(1)) } : n);
        };
        const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, subskills: deleteInNodes(sk.subskills ?? [], path) } : sk) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    const addSubAtPath = async (skillId: string, parentPath: string[], name: string) => {
        const newChild = { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), progress: 0, mastered: false };
        const addInNodes = (nodes: any[], p: string[]): any[] => {
            if (p.length === 0) return [...nodes, newChild];
            if (p.length === 1) return nodes.map(n => n.id === p[0] ? { ...n, subskills: [...(n.subskills ?? []), newChild] } : n);
            return nodes.map(n => n.id === p[0] ? { ...n, subskills: addInNodes(n.subskills ?? [], p.slice(1)) } : n);
        };
        const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, subskills: addInNodes(sk.subskills ?? [], parentPath) } : sk) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    // ── recursive nested subskill renderer ───────────────────────────────────
    const renderNestedSub = (sub: any, skillId: string, path: string[], skillType: string, depth: number): React.ReactNode => {
        const compositeKey = `${skillId}_${path.join('_')}`;
        const isExpanded = expandedSubs[compositeKey] ?? false;
        const isClaimed = claimedSubs[compositeKey] ?? !!(sub.xpClaimedAt);
        const avg = computeAverageFromSkill(sub);
        const hasChildren = (sub.subskills ?? []).length > 0;
        const isEditing = nestedEditingSubs[compositeKey] ?? false;
        const storedFrac = sub.amountTarget !== undefined ? `${sub.amountValue ?? 0}/${sub.amountTarget}` : null;

        const handleNestedComplete = () => {
            if (isClaimed || !onAwardXp) return;
            const countActive = (nodes: any[]): number =>
                nodes.reduce((acc: number, n: any) => acc + ((n.progress ?? 0) > 0 ? 1 : 0) + countActive(n.subskills ?? []), 0);
            const activeSubs = countActive(sub.subskills ?? []);
            const awarded = avg > 0 ? Math.round(avg) + (1 + activeSubs) * 25 + (sub.levelCount ?? 1) ** 2 : 0;
            if (awarded === 0) return;
            const ucNow = userCharacters[charId] ?? {};
            const charXp = typeof ucNow.xp === 'number' ? ucNow.xp : 0;
            const charLevel = typeof ucNow.level === 'number' ? ucNow.level : 1;
            showXpPopup(compositeKey, awarded, charXp, charLevel);
            setClaimedSubs(prev => ({ ...prev, [compositeKey]: true }));
            updateSubByPath(skillId, path, { xpClaimedAt: Date.now() });
            onAwardXp(awarded);
        };

        return (
            <div key={compositeKey} style={{ marginLeft: `${depth * 10}px` }}
                className="flex flex-col text-sm py-1 border-b border-gray-100 last:border-b-0">
                {xpPopups[compositeKey] && (() => {
                    const p = xpPopups[compositeKey]!; return (
                        <div className="relative mb-1">
                            <div className="bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 pointer-events-none">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-amber-600">+{p.awarded} XP</span>
                                    {p.leveledUp && <span className="text-xs font-bold text-emerald-500">⬆ Level Up!</span>}
                                </div>
                                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                                    <div className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out" style={{ width: `${Math.min(100, p.fill)}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })()}
                <div className="flex items-start gap-1">
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        {isEditing ? (
                            <input className="border rounded px-2 py-1 text-xs w-full"
                                value={nestedSubEditText[compositeKey] ?? sub.name}
                                onChange={e => setNestedSubEditText(prev => ({ ...prev, [compositeKey]: e.target.value }))}
                                onBlur={() => {
                                    const newName = (nestedSubEditText[compositeKey] ?? sub.name).trim();
                                    updateSubByPath(skillId, path, { name: newName || sub.name });
                                    setNestedEditingSubs(prev => { const c = { ...prev }; delete c[compositeKey]; return c; });
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                    if (e.key === 'Escape') setNestedEditingSubs(prev => { const c = { ...prev }; delete c[compositeKey]; return c; });
                                }} />
                        ) : (
                            <div className="break-words cursor-pointer text-gray-600 text-xs flex items-center gap-1 flex-wrap"
                                onClick={() => { setNestedEditingSubs(prev => ({ ...prev, [compositeKey]: true })); setNestedSubEditText(prev => ({ ...prev, [compositeKey]: sub.name })); }}>
                                ↳ {sub.name}{(sub.levelCount && sub.levelCount >= 2) && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5">Lv {sub.levelCount}</span>}{(sub.updatedAt || sub.createdAt) && <span className="text-[10px] text-gray-400">updated: {new Date(sub.updatedAt ?? sub.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
                            </div>
                        )}
                        {skillType === 'data' ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden shrink-0"><div className="h-2 transition-all duration-1000 ease-out" style={{ width: `${avg}%`, background: getDataColor(avg) }} /></div>
                                {hasChildren ? (
                                    <span className="text-xs text-gray-500">{Math.round(avg)}%</span>
                                ) : (
                                    <>
                                        <input type="number" list="cm-prog-presets"
                                            value={(numInputValues ?? {})[compositeKey] ?? String(Math.round(avg))}
                                            onChange={e => setNumInputValues(prev => ({ ...(prev ?? {}), [compositeKey]: e.target.value }))}
                                            onBlur={e => {
                                                const v = Math.max(0, Math.min(100, Math.floor(parseFloat((e.target as HTMLInputElement).value) || 0)));
                                                updateSubByPath(skillId, path, { progress: v, mastered: v >= 100, amountValue: undefined, amountTarget: undefined });
                                                setNumInputValues(prev => { const c = { ...(prev ?? {}) }; delete c[compositeKey]; return c; });
                                                setNestedCustomInputs(prev => { const c = { ...prev }; delete c[compositeKey]; return c; });
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            className="w-16 border rounded px-1 py-0.5 text-xs" />
                                        <datalist id="cm-prog-presets"><option value="50" /><option value="100" /></datalist>
                                        {nestedCustomInputs[compositeKey] !== undefined ? (
                                            <input type="text" value={nestedFractionInputs[compositeKey] ?? ''} placeholder="17/25" autoFocus
                                                onChange={e => setNestedFractionInputs(prev => ({ ...prev, [compositeKey]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                onBlur={() => {
                                                    const input = nestedFractionInputs[compositeKey] ?? '';
                                                    const parsed = parseFraction(input);
                                                    if (parsed) {
                                                        const pct = parsed.target > 0 ? Math.max(0, Math.min(100, Math.round((parsed.value / parsed.target) * 100))) : 0;
                                                        updateSubByPath(skillId, path, { progress: pct, mastered: pct >= 100, amountValue: parsed.value, amountTarget: parsed.target });
                                                    } else {
                                                        const n = parseFloat(input);
                                                        if (!isNaN(n)) updateSubByPath(skillId, path, { progress: Math.max(0, Math.min(100, Math.round(n))), mastered: Math.round(n) >= 100, amountValue: undefined, amountTarget: undefined });
                                                    }
                                                    setNestedCustomInputs(prev => { const c = { ...prev }; delete c[compositeKey]; return c; });
                                                }}
                                                className="w-20 border rounded px-1 py-0.5 text-xs" />
                                        ) : (
                                            <button onClick={() => { setNestedCustomInputs(prev => ({ ...prev, [compositeKey]: 0 })); setNestedFractionInputs(prev => ({ ...prev, [compositeKey]: storedFrac ?? '' })); }}
                                                className="text-xs text-blue-500 hover:underline whitespace-nowrap">{storedFrac ?? 'Set score'}</button>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                                <div className="w-24 h-1 bg-gray-200 rounded overflow-hidden shrink-0"><div className="h-1 transition-all duration-1000 ease-out bg-green-500" style={{ width: `${Math.min(100, sub.progress ?? 0)}%` }} /></div>
                                <div className="text-xs text-gray-600">{Math.round(sub.progress ?? 0)}%</div>
                                <button onClick={() => updateSubByPath(skillId, path, { progress: Math.min(100, (sub.progress ?? 0) + 10), mastered: ((sub.progress ?? 0) + 10) >= 100 })} className="px-1.5 py-0.5 bg-blue-400 text-white text-xs rounded">Train</button>
                            </div>
                        )}
                        <button onClick={handleNestedComplete} disabled={isClaimed || avg === 0}
                            title={isClaimed ? 'XP already claimed' : 'Complete — earn XP'}
                            className={`mt-0.5 text-xs w-6 h-5 rounded flex items-center justify-center ${isClaimed || avg === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-purple-500 text-white hover:bg-purple-600'
                                }`}>✨</button>
                        {(() => {
                            const isLeaf = !Array.isArray(sub.subskills) || sub.subskills.length === 0;
                            const sectionComplete = isLeaf
                                ? (sub.progress ?? 0) >= 100
                                : (sub.subskills as any[]).every((c: any) => (c.progress ?? 0) >= 100);
                            if (!sectionComplete) return null;
                            const resetLeaves = (nodes: any[]): any[] => nodes.map((n: any) => {
                                if (!Array.isArray(n.subskills) || n.subskills.length === 0)
                                    return { ...n, progress: 0, levelCount: (n.levelCount ?? 1) + 1, mastered: false, xpClaimedAt: undefined };
                                return { ...n, xpClaimedAt: undefined, subskills: resetLeaves(n.subskills ?? []) };
                            });
                            const handleLevelUp = () => {
                                setClaimedSubs(prev => { const c = { ...prev }; delete c[compositeKey]; return c; });
                                if (isLeaf) {
                                    updateSubByPath(skillId, path, { progress: 0, levelCount: (sub.levelCount ?? 1) + 1, mastered: false, amountValue: undefined, amountTarget: undefined, xpClaimedAt: undefined });
                                } else {
                                    updateSubByPath(skillId, path, { subskills: resetLeaves(sub.subskills ?? []), progress: 0, mastered: false, xpClaimedAt: undefined });
                                }
                            };
                            return (
                                <button onClick={handleLevelUp}
                                    className="mt-1 w-full px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium">
                                    ⬆ Level Up
                                </button>
                            );
                        })()}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                        {hasChildren && (
                            <button onClick={() => setExpandedSubs(prev => ({ ...prev, [compositeKey]: !prev[compositeKey] }))}
                                className="text-blue-400 hover:text-blue-600 text-base w-5 h-5 flex items-center justify-center">
                                {isExpanded ? '▾' : '▸'}
                            </button>
                        )}
                        <button onClick={() => { setAddingNestedFor(compositeKey); setNewNestedName(''); }}
                            title="Add nested subskill"
                            className="text-emerald-600 hover:text-emerald-700 text-xs w-5 h-5 flex items-center justify-center">+</button>
                        <button onClick={async () => { if (!window.confirm(`Delete "${sub.name}"?`)) return; await deleteSubByPath(skillId, path); }}
                            className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                    </div>
                </div>
                {addingNestedFor === compositeKey && (
                    <div className="flex gap-1 mt-1">
                        <input value={newNestedName} onChange={e => setNewNestedName(e.target.value)}
                            placeholder="Nested name" autoFocus className="flex-1 border rounded px-2 py-0.5 text-xs"
                            onKeyDown={async e => {
                                if (e.key === 'Enter' && newNestedName.trim()) { await addSubAtPath(skillId, path, newNestedName); setExpandedSubs(prev => ({ ...prev, [compositeKey]: true })); setAddingNestedFor(null); setNewNestedName(''); }
                                if (e.key === 'Escape') { setAddingNestedFor(null); setNewNestedName(''); }
                            }} />
                        <button onClick={async () => { if (newNestedName.trim()) { await addSubAtPath(skillId, path, newNestedName); setExpandedSubs(prev => ({ ...prev, [compositeKey]: true })); setAddingNestedFor(null); setNewNestedName(''); } }}
                            className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded">+</button>
                        <button onClick={() => { setAddingNestedFor(null); setNewNestedName(''); }} className="px-2 py-0.5 bg-gray-100 text-xs rounded">✕</button>
                    </div>
                )}
                {isExpanded && (
                    <div className="mt-0.5">
                        {(sub.subskills ?? []).map((child: any) => renderNestedSub(child, skillId, [...path, child.id], skillType, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const deleteSubskill = async (skillId: string, subId: string) => {
        if (!window.confirm('Delete this subskill? This cannot be undone.')) return;
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).filter((ss: any) => ss.id !== subId) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    const deleteSkill = async (skillId: string) => {
        const updated = { ...uc, skills: (uc.skills ?? []).filter((s: any) => s.id !== skillId) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    const saveEditedSkill = async (skillId: string, name: string) => {
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, name: name.trim() || s.name } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
        setEditing(prev => { const c = { ...prev }; delete c[skillId]; return c; });
    };

    const addTopLevelSkill = async () => {
        const now = Date.now();
        const newSkill = { id: `${now}_${Math.random().toString(36).slice(2, 6)}`, name: 'New Skill', type: 'data', progress: 0, subskills: [] };
        const updated = { ...uc, skills: [newSkill, ...(uc.skills ?? [])] };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    return (
        <>
        <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
                <div className="font-semibold">Skills</div>
                <div className="flex items-center gap-2">
                    <button onClick={addTopLevelSkill} className="px-2 py-1 bg-emerald-500 text-white rounded text-sm" disabled={controlsDisabled}>+ Skill</button>
                </div>
            </div>

            {(uc.skills ?? []).map((s: any) => {
                const average = computeAverageFromSkill(s);
                return (
                    <div key={s.id} ref={el => { skillRefs.current[s.id] = el; }} className="p-2 border rounded">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="font-medium flex items-center gap-1">{editing[s.id] ? (
                                    <input className="border rounded px-2 py-1 text-sm max-w-full" defaultValue={s.name} autoFocus
                                        onBlur={(e) => saveEditedSkill(s.id, e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(prev => { const c = { ...prev }; delete c[s.id]; return c; }); }} />
                                ) : (
                                    <>
                                        <div className="text-sm truncate w-[12ch] flex-shrink-0 cursor-pointer hover:text-blue-500" title={s.name} onClick={() => setEditing(prev => ({ ...prev, [s.id]: true }))}>{truncateTo16(s.name)}</div>
                                        {(s.levelCount && s.levelCount >= 2) && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 flex-shrink-0">Lv {s.levelCount}</span>}
                                        {s.createdAt && <span className="text-[10px] text-gray-400 flex-shrink-0">{new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
                                    </>
                                )}</div>
                                {s.type === 'data' && (s.subskills ?? []).length === 0 ? (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <input
                                            type="number"
                                            list="cm-prog-presets"
                                            value={numInputValues[s.id] ?? String(Math.round(average))}
                                            onChange={e => setNumInputValues(prev => ({ ...prev, [s.id]: e.target.value }))}
                                            onBlur={e => {
                                                const v = Math.max(0, Math.min(100, Math.floor(parseFloat((e.target as HTMLInputElement).value) || 0)));
                                                setLoneSkillProgress(s.id, v);
                                                setNumInputValues(prev => { const c = { ...prev }; delete c[s.id]; return c; });
                                                setLoneEditings(prev => { const c = { ...prev }; delete c[s.id]; return c; });
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                            className="w-16 border rounded px-1 py-0.5 text-xs"
                                        />
                                        <datalist id="cm-prog-presets-lone"><option value="50" /><option value="100" /></datalist>
                                        {loneEditings[s.id] ? (
                                            <input
                                                type="text"
                                                value={loneInputValues[s.id] ?? ''}
                                                placeholder="17/25"
                                                autoFocus
                                                onChange={e => setLoneInputValues(prev => ({ ...prev, [s.id]: e.target.value }))}
                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                onBlur={() => {
                                                    const input = loneInputValues[s.id] ?? '';
                                                    const parsed = parseFraction(input);
                                                    if (parsed) {
                                                        const pct = parsed.target > 0 ? Math.max(0, Math.min(100, Math.round((parsed.value / parsed.target) * 100))) : 0;
                                                        setLoneSkillProgress(s.id, pct, parsed.value, parsed.target);
                                                    } else {
                                                        const n = parseFloat(input);
                                                        if (!isNaN(n)) setLoneSkillProgress(s.id, Math.max(0, Math.min(100, Math.round(n))));
                                                    }
                                                    setLoneEditings(prev => { const c = { ...prev }; delete c[s.id]; return c; });
                                                }}
                                                className="w-20 border rounded px-1 py-0.5 text-xs"
                                            />
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setLoneEditings(prev => ({ ...prev, [s.id]: true }));
                                                    setLoneInputValues(prev => ({ ...prev, [s.id]: s.amountTarget !== undefined ? `${s.amountValue ?? 0}/${s.amountTarget}` : '' }));
                                                }}
                                                className="text-xs text-blue-500 hover:underline whitespace-nowrap"
                                            >
                                                {s.amountTarget !== undefined ? `${s.amountValue ?? 0}/${s.amountTarget}` : 'Set score'}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-700 w-12 text-right">{s.type === 'data' ? `${Math.round(average)}%` : `${Math.round(s.progress ?? 0)}%`}</div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {s.type !== 'data' && <button onClick={() => { const inc = 10; const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, progress: Math.min(100, (sk.progress ?? 0) + inc), mastered: ((sk.progress ?? 0) + inc) >= 100 } : sk) }; setUserCharacters(prev => ({ ...prev, [charId]: updated })); saveCharacter(updated).catch(console.error); }} className="px-2 py-1 bg-blue-500 text-white rounded text-xs" disabled={controlsDisabled}>Train</button>}
                                <button onClick={() => setConfirmDeleteSkill({ id: s.id, name: s.name })} className="px-2 py-1 bg-red-500 text-white rounded text-xs" disabled={controlsDisabled}>Delete</button>
                            </div>
                        </div>

                        {(s.subskills ?? []).length === 0 && (
                            <div className="mt-1 w-full h-2 bg-gray-200 rounded overflow-hidden">
                                <div className="h-2 transition-all duration-1000 ease-out" style={{ width: `${s.type === 'data' ? average : Math.min(100, s.progress ?? 0)}%`, background: s.type === 'data' ? getDataColor(average) : '#16a34a' }} />
                            </div>
                        )}
                        {(s.subskills ?? []).length === 0 && (() => {
                            const prog = s.type === 'data' ? average : Math.min(100, s.progress ?? 0);
                            const isClaimed = !!(s.xpClaimedAt);
                            return (
                                <>
                                    {xpPopups[s.id] && (() => {
                                        const p = xpPopups[s.id]!; return (
                                            <div className="bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 pointer-events-none mt-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-xs font-bold text-amber-600">+{p.awarded} XP</span>
                                                    {p.leveledUp && <span className="text-xs font-bold text-emerald-500">⬆ Level Up!</span>}
                                                </div>
                                                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                                                    <div className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out" style={{ width: `${Math.min(100, p.fill)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    <button
                                        onClick={() => {
                                            if (isClaimed || !onAwardXp || prog === 0) return;
                                            const awarded = Math.round(prog) + 25 + (s.levelCount ?? 1) ** 2;
                                            const ucNow = userCharacters[charId] ?? {};
                                            const charXp = typeof ucNow.xp === 'number' ? ucNow.xp : 0;
                                            const charLevel = typeof ucNow.level === 'number' ? ucNow.level : 1;
                                            showXpPopup(s.id, awarded, charXp, charLevel);
                                            const nowTs = Date.now();
                                            const updatedChar = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, xpClaimedAt: nowTs } : sk) };
                                            setUserCharacters(prev => ({ ...prev, [charId]: updatedChar }));
                                            saveCharacter(updatedChar).catch(console.error);
                                            onAwardXp(awarded);
                                        }}
                                        disabled={isClaimed || prog === 0}
                                        title={isClaimed ? 'XP already claimed' : 'Complete — earn XP'}
                                        className={`mt-1 text-xs w-6 h-5 rounded flex items-center justify-center ${isClaimed || prog === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-purple-500 text-white hover:bg-purple-600'
                                            }`}>✨</button>
                                </>
                            );
                        })()}
                        {(s.subskills ?? []).length === 0 && (() => {
                            const prog = s.type === 'data' ? average : Math.min(100, s.progress ?? 0);
                            if (prog < 100) return null;
                            const handleLoneSkillLevelUp = () => {
                                const newLevel = (s.levelCount ?? 1) + 1;
                                const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, progress: 0, levelCount: newLevel, mastered: false, amountValue: undefined, amountTarget: undefined, xpClaimedAt: undefined } : sk) };
                                setUserCharacters(prev => ({ ...prev, [charId]: updated }));
                                saveCharacter(updated).catch(console.error);
                            };
                            return (
                                <button onClick={handleLoneSkillLevelUp}
                                    className="mt-1 w-full px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium">
                                    ⬆ Level Up
                                </button>
                            );
                        })()}

                        <div className="mt-2">
                            {(s.subskills ?? []).length === 0 ? (
                                <div className="text-xs text-gray-500">No subskills</div>
                            ) : (
                                (s.subskills ?? []).map((ss: any) => (
                                    <div key={ss.id} className="flex flex-col text-sm py-1 border-b border-gray-100 last:border-b-0">
                                        <div className="flex items-start justify-between gap-1">
                                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                                {editingSub[ss.id] ? (
                                                    <input
                                                        className="border rounded px-2 py-1 text-sm w-full"
                                                        value={subEditText[ss.id] ?? ss.name}
                                                        onChange={e => setSubEditText(prev => ({ ...prev, [ss.id]: e.target.value }))}
                                                        onBlur={() => {
                                                            const newName = (subEditText[ss.id] ?? ss.name).trim();
                                                            const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, subskills: (sk.subskills ?? []).map((x: any) => x.id === ss.id ? { ...x, name: newName || x.name } : x) } : sk) };
                                                            setUserCharacters(prev => ({ ...prev, [charId]: updated }));
                                                            saveCharacter(updated).catch(console.error);
                                                            setEditingSub(prev => { const c = { ...prev }; delete c[ss.id]; return c; });
                                                            setSubEditText(prev => { const c = { ...prev }; delete c[ss.id]; return c; });
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') { setEditingSub(prev => { const c = { ...prev }; delete c[ss.id]; return c; }); setSubEditText(prev => { const c = { ...prev }; delete c[ss.id]; return c; }); }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="break-words cursor-pointer text-gray-700 flex items-center gap-1 flex-wrap" title={ss.name} onClick={() => { setEditingSub(prev => ({ ...prev, [ss.id]: true })); setSubEditText(prev => ({ ...prev, [ss.id]: ss.name })); }}>↳ {ss.name}{(ss.levelCount && ss.levelCount >= 2) && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5">Lv {ss.levelCount}</span>}{(ss.updatedAt || ss.createdAt) && <span className="text-[10px] text-gray-400">updated: {new Date(ss.updatedAt ?? ss.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}</div>
                                                )}
                                                {s.type === 'data' ? (
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden shrink-0"><div className="h-2 transition-all duration-1000 ease-out" style={{ width: `${computeAverageFromSkill(ss)}%`, background: getDataColor(computeAverageFromSkill(ss)) }} /></div>
                                                        {(() => {
                                                            const cur = computeAverageFromSkill(ss);
                                                            const key = `${s.id}_${ss.id}`;
                                                            const storedFrac = ss.amountTarget !== undefined ? `${ss.amountValue ?? 0}/${ss.amountTarget}` : null;
                                                            const ssHasChildren = (ss.subskills ?? []).length > 0;
                                                            return (
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    {ssHasChildren ? (
                                                                        <span className="text-xs text-gray-500">{Math.round(cur)}%</span>
                                                                    ) : (
                                                                        <>
                                                                            <input type="number" list="cm-prog-presets"
                                                                                value={numInputValues[key] ?? String(Math.round(cur))}
                                                                                onChange={e => setNumInputValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                onBlur={e => {
                                                                                    const v = Math.max(0, Math.min(100, Math.floor(parseFloat((e.target as HTMLInputElement).value) || 0)));
                                                                                    setSubskillDataProgress(s.id, ss.id, v);
                                                                                    setNumInputValues(prev => { const c = { ...prev }; delete c[key]; return c; });
                                                                                    setCustomInputs(prev => { const c = { ...prev }; delete c[key]; return c; });
                                                                                }}
                                                                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                                className="w-16 border rounded px-1 py-0.5 text-xs" />
                                                                            <datalist id="cm-prog-presets"><option value="50" /><option value="100" /></datalist>
                                                                            {customInputs[key] !== undefined ? (
                                                                                <input
                                                                                    type="text"
                                                                                    value={fractionInputs[key] ?? ''}
                                                                                    placeholder="17/25"
                                                                                    autoFocus
                                                                                    onChange={e => setFractionInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                                                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                                    onBlur={() => {
                                                                                        const input = fractionInputs[key] ?? '';
                                                                                        const parsed = parseFraction(input);
                                                                                        if (parsed) {
                                                                                            const pct = parsed.target > 0 ? Math.max(0, Math.min(100, Math.round((parsed.value / parsed.target) * 100))) : 0;
                                                                                            setSubskillFractionProgress(s.id, ss.id, pct, parsed.value, parsed.target);
                                                                                        } else {
                                                                                            const n = parseFloat(input);
                                                                                            if (!isNaN(n)) setSubskillDataProgress(s.id, ss.id, Math.max(0, Math.min(100, Math.round(n))));
                                                                                        }
                                                                                        setCustomInputs(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
                                                                                    }}
                                                                                    className="w-20 border rounded px-1 py-0.5 text-xs"
                                                                                />
                                                                            ) : (
                                                                                <button onClick={() => { setCustomInputs(prev => ({ ...prev, [key]: 0 })); setFractionInputs(prev => ({ ...prev, [key]: storedFrac ?? '' })); }}
                                                                                    className="text-xs text-blue-500 hover:underline whitespace-nowrap">{storedFrac ?? 'Set score'}</button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <div className="w-24 h-1 bg-gray-200 rounded overflow-hidden shrink-0"><div className="h-1 transition-all duration-1000 ease-out bg-green-500" style={{ width: `${Math.min(100, ss.progress ?? 0)}%` }} /></div>
                                                        <div className="text-xs text-gray-600">{Math.round(ss.progress ?? 0)}%</div>
                                                        <button onClick={() => trainSubskill(s.id, ss.id, 10)} className="px-2 py-1 bg-blue-400 text-white text-xs rounded">Train</button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                {(ss.subskills ?? []).length > 0 && (
                                                    <button
                                                        onClick={() => setExpandedSubs(prev => ({ ...prev, [`${s.id}_${ss.id}`]: !prev[`${s.id}_${ss.id}`] }))}
                                                        className="text-blue-400 hover:text-blue-600 text-base w-5 h-5 flex items-center justify-center">
                                                        {expandedSubs[`${s.id}_${ss.id}`] ? '▾' : '▸'}
                                                    </button>
                                                )}
                                                <button onClick={() => { setAddingNestedFor(`${s.id}_${ss.id}`); setNewNestedName(''); }}
                                                    title="Add nested subskill"
                                                    className="text-emerald-600 hover:text-emerald-700 text-xs w-5 h-5 flex items-center justify-center">+</button>
                                                <button onClick={() => deleteSubskill(s.id, ss.id)} title="Delete subskill" className="text-red-500 hover:text-red-700 px-1 py-0.5 rounded text-xs">✕</button>
                                            </div>
                                        </div>
                                        {(() => {
                                            const cKey = `${s.id}_${ss.id}`;
                                            const isClaimed = claimedSubs[cKey] ?? !!(ss.xpClaimedAt);
                                            const avg = computeAverageFromSkill(ss);
                                            return (
                                                <>
                                                    {xpPopups[cKey] && (() => {
                                                        const p = xpPopups[cKey]!; return (
                                                            <div className="bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 pointer-events-none mb-1">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className="text-xs font-bold text-amber-600">+{p.awarded} XP</span>
                                                                    {p.leveledUp && <span className="text-xs font-bold text-emerald-500">⬆ Level Up!</span>}
                                                                </div>
                                                                <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                                                                    <div className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out" style={{ width: `${Math.min(100, p.fill)}%` }} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    <button
                                                        onClick={() => {
                                                            if (isClaimed || !onAwardXp) return;
                                                            const countActive = (nodes: any[]): number => nodes.reduce((acc: number, n: any) => acc + ((n.progress ?? 0) > 0 ? 1 : 0) + countActive(n.subskills ?? []), 0);
                                                            const activeSubs = countActive(ss.subskills ?? []);
                                                            const awarded = avg > 0 ? Math.round(avg) + (1 + activeSubs) * 25 + (ss.levelCount ?? 1) ** 2 : 0;
                                                            if (awarded === 0) return;
                                                            const ucNow = userCharacters[charId] ?? {};
                                                            const charXp = typeof ucNow.xp === 'number' ? ucNow.xp : 0;
                                                            const charLevel = typeof ucNow.level === 'number' ? ucNow.level : 1;
                                                            showXpPopup(cKey, awarded, charXp, charLevel);
                                                            setClaimedSubs(prev => ({ ...prev, [cKey]: true }));
                                                            const nowTs = Date.now();
                                                            const updatedSkills = (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, subskills: (sk.subskills ?? []).map((x: any) => x.id === ss.id ? { ...x, xpClaimedAt: nowTs } : x) } : sk);
                                                            const updatedChar = { ...uc, skills: updatedSkills };
                                                            setUserCharacters(prev => ({ ...prev, [charId]: updatedChar }));
                                                            saveCharacter(updatedChar).catch(console.error);
                                                            onAwardXp(awarded);
                                                        }}
                                                        disabled={isClaimed || avg === 0}
                                                        title={isClaimed ? 'XP already claimed' : 'Complete — earn XP'}
                                                        className={`mt-0.5 text-xs w-6 h-5 rounded flex items-center justify-center ${isClaimed || avg === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-purple-500 text-white hover:bg-purple-600'
                                                            }`}>✨</button>
                                                </>
                                            );
                                        })()}
                                        {(() => {
                                            const isLeaf = !Array.isArray(ss.subskills) || ss.subskills.length === 0;
                                            const sectionComplete = isLeaf
                                                ? (ss.progress ?? 0) >= 100
                                                : (ss.subskills as any[]).every((c: any) => (c.progress ?? 0) >= 100);
                                            if (!sectionComplete) return null;
                                            const cKey = `${s.id}_${ss.id}`;
                                            const resetLeaves = (nodes: any[]): any[] => nodes.map((n: any) => {
                                                if (!Array.isArray(n.subskills) || n.subskills.length === 0)
                                                    return { ...n, progress: 0, levelCount: (n.levelCount ?? 1) + 1, mastered: false, xpClaimedAt: undefined };
                                                return { ...n, xpClaimedAt: undefined, subskills: resetLeaves(n.subskills ?? []) };
                                            });
                                            const handleLevelUp = () => {
                                                setClaimedSubs(prev => { const c = { ...prev }; delete c[cKey]; return c; });
                                                const updated = isLeaf
                                                    ? { progress: 0, levelCount: (ss.levelCount ?? 1) + 1, mastered: false, amountValue: undefined, amountTarget: undefined, xpClaimedAt: undefined }
                                                    : { subskills: resetLeaves(ss.subskills ?? []), progress: 0, mastered: false, xpClaimedAt: undefined };
                                                const updatedSkills = (uc.skills ?? []).map((sk: any) => sk.id === s.id ? { ...sk, subskills: (sk.subskills ?? []).map((x: any) => x.id === ss.id ? { ...x, ...updated } : x) } : sk);
                                                const updatedChar = { ...uc, skills: updatedSkills };
                                                setUserCharacters(prev => ({ ...prev, [charId]: updatedChar }));
                                                saveCharacter(updatedChar).catch(console.error);
                                            };
                                            return (
                                                <button onClick={handleLevelUp}
                                                    className="mt-1 w-full px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-xs font-medium">
                                                    ⬆ Level Up
                                                </button>
                                            );
                                        })()}
                                        {addingNestedFor === `${s.id}_${ss.id}` && (
                                            <div className="flex gap-1 mt-1">
                                                <input value={newNestedName} onChange={e => setNewNestedName(e.target.value)}
                                                    placeholder="Nested name" autoFocus className="flex-1 border rounded px-2 py-0.5 text-xs"
                                                    onKeyDown={async e => {
                                                        if (e.key === 'Enter' && newNestedName.trim()) { await addSubAtPath(s.id, [ss.id], newNestedName); setExpandedSubs(prev => ({ ...prev, [`${s.id}_${ss.id}`]: true })); setAddingNestedFor(null); setNewNestedName(''); }
                                                        if (e.key === 'Escape') { setAddingNestedFor(null); setNewNestedName(''); }
                                                    }} />
                                                <button onClick={async () => { if (newNestedName.trim()) { await addSubAtPath(s.id, [ss.id], newNestedName); setExpandedSubs(prev => ({ ...prev, [`${s.id}_${ss.id}`]: true })); setAddingNestedFor(null); setNewNestedName(''); } }}
                                                    className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded">+</button>
                                                <button onClick={() => { setAddingNestedFor(null); setNewNestedName(''); }} className="px-2 py-0.5 bg-gray-100 text-xs rounded">✕</button>
                                            </div>
                                        )}
                                        {expandedSubs[`${s.id}_${ss.id}`] && (
                                            <div className="mt-0.5 border-l-2 border-gray-100 pl-2">
                                                {(ss.subskills ?? []).map((child: any) => renderNestedSub(child, s.id, [ss.id, child.id], s.type, 0))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="mt-2">
                            <SubskillCreator charId={charId} skillId={s.id} userCharacters={userCharacters} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} controlsDisabled={controlsDisabled} buttonLabel="+ Sub" />
                        </div>
                    </div>
                );
            })}
        </div>
        {confirmDeleteSkill && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteSkill(null)}>
                <div className="bg-white rounded-xl shadow-xl p-6 max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
                    <p className="text-sm font-semibold mb-1">Delete skill?</p>
                    <p className="text-xs text-gray-500 mb-4">"{confirmDeleteSkill.name}" will be permanently removed.</p>
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setConfirmDeleteSkill(null)} className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
                        <button onClick={() => { deleteSkill(confirmDeleteSkill.id); setConfirmDeleteSkill(null); }} className="px-3 py-1.5 text-sm rounded bg-red-500 text-white hover:bg-red-600">Delete</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default ClassModeSkills;
