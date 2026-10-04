import React, { useState } from 'react';

type Props = {
    charId: string;
    skillId: string;
    sub?: any; // if provided, editor is for editing; otherwise it's for creating when isNew true
    isNew?: boolean;
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    controlsDisabled?: boolean;
    onOpenChange?: (open: boolean) => void;
};

const SubskillEditor: React.FC<Props> = ({ charId, skillId, sub, isNew, userCharacters, setUserCharacters, saveCharacter, controlsDisabled, onOpenChange }) => {
    const [open, setOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [name, setName] = useState('');
    const [customInputs, setCustomInputs] = useState<Record<string, boolean>>({});
    const [fractionInputs, setFractionInputs] = useState<Record<string, string>>({});
    const [editingNested, setEditingNested] = useState<Record<string, boolean>>({});
    const [nestedEditText, setNestedEditText] = useState<Record<string, string>>({});

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

    const setNestedProgress = (nestedId: string, v: number, fVal?: number, fTar?: number) => {
        const uc = userCharacters[charId] ?? {};
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((ss: any) => ss.id === (sub?.id) ? { ...ss, subskills: (ss.subskills ?? []).map((n: any) => n.id === nestedId ? { ...n, progress: v, mastered: v >= 100, ...(fVal !== undefined ? { amountValue: fVal, amountTarget: fTar } : { amountValue: undefined, amountTarget: undefined }) } : n) } : ss) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const trainNested = (nestedId: string, inc: number) => {
        const uc = userCharacters[charId] ?? {};
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((ss: any) => ss.id === sub.id ? { ...ss, subskills: (ss.subskills ?? []).map((n: any) => n.id === nestedId ? { ...n, progress: Math.min(100, (n.progress ?? 0) + inc), mastered: ((n.progress ?? 0) + inc) >= 100 } : n) } : ss) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const deleteNested = async (nestedId: string) => {
        if (!sub) return;
        const nested = (sub.subskills ?? []).find((n: any) => n.id === nestedId);
        if (!nested) return;
        if (!window.confirm(`Delete nested subskill "${nested.name}"? This cannot be undone.`)) return;
        const uc = userCharacters[charId] ?? {};
        const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, subskills: (sk.subskills ?? []).map((ss: any) => ss.id === sub.id ? { ...ss, subskills: (ss.subskills ?? []).filter((n: any) => n.id !== nestedId) } : ss) } : sk) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    const openEditor = () => {
        setName('');
        setOpen(true);
        if (onOpenChange) onOpenChange(true);
    };

    const closeEditor = () => {
        setOpen(false);
        if (onOpenChange) onOpenChange(false);
    };

    const handleSave = async () => {
        // If `sub` prop is provided, we're creating a nested subskill under that subskill.
        const now = Date.now();
        const uc = userCharacters[charId] ?? {};
        if (!sub) {
            // nothing to attach to
            setOpen(false);
            return;
        }
        if (!name.trim()) return;
        const newNested = { id: `${now}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), progress: 0, mastered: false, createdAt: now };
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).map((ss: any) => ss.id === sub.id ? { ...ss, subskills: [...(ss.subskills ?? []), newNested] } : ss) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
        setName('');
        closeEditor();
    };

    const handleDelete = async () => {
        if (!sub) return;
        if (!window.confirm(`Delete subskill "${sub.name}"? This cannot be undone.`)) return;
        const uc = userCharacters[charId] ?? {};
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: (s.subskills ?? []).filter((ss: any) => ss.id !== sub.id) } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
        closeEditor();
    };

    return (
        <div className="w-full">
            {!open ? (
                <>
                    {sub ? (
                        (sub.subskills && sub.subskills.length > 0) ? (
                            <button onClick={() => setExpanded(prev => !prev)} className="px-2 py-1 bg-gray-100 text-xs rounded" disabled={controlsDisabled}>{expanded ? 'Close' : 'Open'}</button>
                        ) : (
                            <button onClick={() => { setOpen(true); if (onOpenChange) onOpenChange(true); }} className="px-2 py-1 bg-emerald-100 text-xs rounded" disabled={controlsDisabled}>Add</button>
                        )
                    ) : (
                        <button onClick={openEditor} className="px-2 py-1 bg-gray-100 text-xs rounded" disabled={controlsDisabled}>+Sub</button>
                    )}
                </>
            ) : null}

            {(expanded || open) && (
                <div className="mt-1 w-full">
                    <div className="p-2 bg-white border rounded shadow space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium w-[16ch] truncate" title={sub ? sub.name : 'Subskills'}>{sub ? (sub.name && sub.name.length > 16 ? `${sub.name.slice(0, 13)}...` : sub.name) : 'Subskills'}</div>
                            <div className="text-sm font-medium w-[12ch] truncate" title={sub ? sub.name : 'Subskills'}>{sub ? (sub.name && sub.name.length > 12 ? `${sub.name.slice(0, 9)}...` : sub.name) : 'Subskills'}</div>
                            <button onClick={() => { setExpanded(false); setOpen(false); if (onOpenChange) onOpenChange(false); }} className="px-2 py-1 bg-gray-100 text-xs rounded">Close</button>
                        </div>

                        {expanded && sub && sub.subskills && (
                            <div className="flex flex-col gap-2 bg-white p-1 rounded">
                                {sub.subskills.map((n: any) => {
                                    const cur = computeAverageFromSkill(n);
                                    const key = `${skillId}_${sub.id}_${n.id}`;
                                    const presetValue = (cur === 50 || cur === 80 || cur === 100) ? String(cur) : 'current';
                                    const selectValue = customInputs[key] !== undefined ? 'custom' : presetValue;
                                    // find parent type
                                    const uc = userCharacters[charId] ?? {};
                                    const parentSkill = (uc.skills ?? []).find((sk: any) => sk.id === skillId) || {};
                                    return (
                                        <div key={n.id} className="flex items-center justify-between text-sm py-1">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {editingNested[n.id] ? (
                                                    <input
                                                        className="border rounded px-2 py-1 text-sm w-full"
                                                        value={nestedEditText[n.id] ?? n.name}
                                                        onChange={e => setNestedEditText(prev => ({ ...prev, [n.id]: e.target.value }))}
                                                        onBlur={() => {
                                                            const newName = (nestedEditText[n.id] ?? n.name).trim();
                                                            const uc = userCharacters[charId] ?? {};
                                                            const updated = { ...uc, skills: (uc.skills ?? []).map((sk: any) => sk.id === skillId ? { ...sk, subskills: (sk.subskills ?? []).map((ss: any) => ss.id === sub.id ? { ...ss, subskills: (ss.subskills ?? []).map((x: any) => x.id === n.id ? { ...x, name: newName || x.name } : x) } : ss) } : sk) };
                                                            setUserCharacters(prev => ({ ...prev, [charId]: updated }));
                                                            saveCharacter(updated).catch(console.error);
                                                            setEditingNested(prev => { const c = { ...prev }; delete c[n.id]; return c; });
                                                            setNestedEditText(prev => { const c = { ...prev }; delete c[n.id]; return c; });
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                            if (e.key === 'Escape') { setEditingNested(prev => { const c = { ...prev }; delete c[n.id]; return c; }); setNestedEditText(prev => { const c = { ...prev }; delete c[n.id]; return c; }); }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="truncate w-[12ch] cursor-pointer" onClick={() => { setEditingNested(prev => ({ ...prev, [n.id]: true })); setNestedEditText(prev => ({ ...prev, [n.id]: n.name })); }}>↳ {n.name}</div>
                                                )}
                                                {parentSkill.type === 'data' ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-28 h-2 bg-gray-200 rounded overflow-hidden"><div className="h-2" style={{ width: `${computeAverageFromSkill(n)}%`, background: getDataColor(computeAverageFromSkill(n)) }} /></div>
                                                        {(() => {
                                                            const storedFrac = n.amountTarget !== undefined ? `${n.amountValue ?? 0}/${n.amountTarget}` : null;
                                                            const selectVal = customInputs[key] ? 'custom' : (cur === 50 ? '50' : cur === 80 ? '80' : cur === 100 ? '100' : 'current');
                                                            return (
                                                                <div className="flex items-center gap-1 flex-wrap">
                                                                    <select value={selectVal} onChange={(e) => {
                                                                        const v = e.target.value;
                                                                        if (v === 'custom') {
                                                                            setCustomInputs(prev => ({ ...prev, [key]: true }));
                                                                            setFractionInputs(prev => ({ ...prev, [key]: storedFrac ?? '' }));
                                                                        } else if (v === 'current') {
                                                                            setCustomInputs(prev => { const c = { ...prev }; delete c[key]; return c; });
                                                                        } else {
                                                                            setCustomInputs(prev => { const c = { ...prev }; delete c[key]; return c; });
                                                                            setNestedProgress(n.id, Number(v));
                                                                        }
                                                                    }} className="text-xs border rounded px-1 py-0.5 bg-white w-[6ch] text-center">
                                                                        <option value="50">50%</option>
                                                                        <option value="80">80%</option>
                                                                        <option value="100">100%</option>
                                                                        <option value="current">{Math.round(cur)}%</option>
                                                                        <option value="custom">Set score</option>
                                                                    </select>
                                                                    {storedFrac && <span className="text-xs text-gray-400">{storedFrac}</span>}
                                                                    {customInputs[key] && (
                                                                        <input
                                                                            type="text"
                                                                            value={fractionInputs[key] ?? ''}
                                                                            placeholder="17/25"
                                                                            autoFocus
                                                                            onChange={e => setFractionInputs(prev => ({ ...prev, [key]: e.target.value }))}
                                                                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                                            onBlur={() => {
                                                                                const input = fractionInputs[key] ?? '';
                                                                                const m = input.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                                                                                if (m) {
                                                                                    const fVal = parseFloat(m[1]); const fTar = parseFloat(m[2]);
                                                                                    const pct = fTar > 0 ? Math.max(0, Math.min(100, Math.round((fVal / fTar) * 100))) : 0;
                                                                                    setNestedProgress(n.id, pct, fVal, fTar);
                                                                                } else {
                                                                                    const num = parseFloat(input);
                                                                                    if (!isNaN(num)) setNestedProgress(n.id, Math.max(0, Math.min(100, Math.round(num))));
                                                                                }
                                                                                setCustomInputs(prev => { const c = { ...prev }; delete c[key]; return c; });
                                                                            }}
                                                                            className="w-20 border rounded px-1 py-0.5 text-xs"
                                                                        />
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="w-20 h-1 bg-gray-200 rounded overflow-hidden"><div className="h-1 transition-all duration-700 ease-out bg-green-500" style={{ width: `${Math.min(100, n.progress ?? 0)}%` }} /></div>
                                                        <div className="text-xs text-gray-600">{Math.round(n.progress ?? 0)}%</div>
                                                        <button onClick={() => trainNested(n.id, 10)} className="px-2 py-1 bg-blue-400 text-white text-xs rounded ml-2">Train</button>
                                                    </>
                                                )}
                                            </div>
                                            <div className="ml-2 flex-shrink-0">
                                                <button onClick={() => deleteNested(n.id)} title="Delete nested subskill" className="text-red-500 hover:text-red-700 px-2 py-0.5 rounded text-xs">✕</button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Add button shown under list when expanded but creator not open */}
                                {!open && (
                                    <div className="pt-2">
                                        <button onClick={() => { setOpen(true); if (onOpenChange) onOpenChange(true); }} className="px-2 py-1 bg-emerald-500 text-white rounded text-sm">Add</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {open && (
                            <div>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="New nested subskill name" className=" border rounded w-full px-2 py-1 text-sm" />
                                <div className="flex gap-2 mt-2 justify-start">
                                    <button onClick={handleSave} className="px-2 py-1 bg-emerald-500 text-white rounded text-xs">Add</button>
                                    <button onClick={() => { closeEditor(); setExpanded(false); }} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
    ;
;

export default SubskillEditor;
