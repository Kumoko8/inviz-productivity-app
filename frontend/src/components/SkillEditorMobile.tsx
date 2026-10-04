import React, { useState, useEffect, useRef } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../firebase';
import HPPanel from './HPPanel';
import XPPanel from './XPPanel';
import CharacterSelector from './CharacterSelector';
import LevelUpOverlay from './LevelUpOverlay';

interface SkillEditorMobileProps {
    skills?: any[];
    selectedSkillId?: string | null;
    selectedCharacter?: any | null;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    controlsDisabled?: boolean;
    onClose?: () => void;
    addSkill?: (name?: string, opts?: { type?: string; amountTarget?: number }) => void;
    updateSkill?: (skillId: string, p: number) => void;
    addSubskill?: (skillId: string, name: string) => void;
    updateSubskill?: (skillId: string, subId: string, updates: any) => void;
    deleteSubskill?: (skillId: string, subId: string) => void;
    onLevelUp?: (skillId: string) => void;
    onRename?: (skillId: string, newName: string) => void;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.floor(v)));

const SkillEditorMobile: React.FC<SkillEditorMobileProps> = ({ skills = [], selectedSkillId = null, selectedCharacter = null, setUserCharacters, saveCharacter, controlsDisabled = false, onClose, addSkill, updateSkill, addSubskill, updateSubskill, deleteSubskill, onLevelUp, onRename }) => {
    const [selectedId, setSelectedId] = useState<string | null>(selectedSkillId || null);
    const [query, setQuery] = useState<string>('');
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const [showCharacterExpanded, setShowCharacterExpanded] = useState(false);
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const [animationUrl, setAnimationUrl] = useState<string>('');
    const [animationError, setAnimationError] = useState<string>('');
    const [showLevelToast, setShowLevelToast] = useState(false);
    const prevSkillProgressRef = useRef<number | null>(null);

    useEffect(() => setSelectedId(selectedSkillId || null), [selectedSkillId]);



    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (typeof window !== 'undefined') (window as any).__skillEditorJustClosed = Date.now();
                onClose && onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const getSkill = (id: string | null) => {
        if (!id) return null;
        return (skills || []).find((s: any) => s.id === id) || null;
    };

    const skill = getSkill(selectedId);
    const skillsLengthRef = React.useRef((skills || []).length);

    const computeAverageFromSkill = (s: any): number => {
        if (!s) return 0;
        if (!s.subskills || s.subskills.length === 0) return Math.round(s.progress ?? 0);
        const vals: number[] = s.subskills.map((ss: any) => computeAverageFromSkill(ss));
        const sum = vals.reduce((a, b) => a + b, 0);
        return Math.round(sum / vals.length);
    };

    // detect when a new top-level skill was added (parent will pass updated `skills` prop)
    useEffect(() => {
        const prev = skillsLengthRef.current || 0;
        const now = (skills || []).length;
        if (now > prev) {
            // assume new skill is prepended at index 0
            const newSkill = (skills || [])[0];
            if (newSkill && newSkill.id) {
                setSelectedId(newSkill.id);
                setIsEditingName(true);
                // focus will be handled by isEditingName effect
            }
        }
        skillsLengthRef.current = now;
    }, [skills]);

    // helper to fetch animation URL (matches usePreviewLoader logic)
    const fetchUrlForPath = async (path?: string): Promise<string> => {
        setAnimationError('');
        if (!path) return '';
        const pRaw = path.toString().trim();
        if (!pRaw) return '';
        if (pRaw.startsWith('http://') || pRaw.startsWith('https://')) return pRaw;

        // Try the raw path first, then a few fallbacks for common malformed values
        const tryCandidates = [pRaw];
        if (pRaw.includes(' ')) {
            // replace first space with slash: "id characters/xyz.mp4" -> "id/characters/xyz.mp4"
            tryCandidates.push(pRaw.replace(/\s+/, '/'));
            // try last segment after space: "id characters/xyz.mp4" -> "characters/xyz.mp4"
            const last = pRaw.split(/\s+/).pop();
            if (last) tryCandidates.push(last);
        }

        for (const cand of tryCandidates) {
            try {
                const r = ref(storage, cand);
                const url = await getDownloadURL(r);
                return url;
            } catch (err) {
                // continue to next candidate
                console.debug('fetchUrlForPath: candidate failed', cand, (err && (err as any).message) || err || '');
            }
        }

        const msg = `Could not fetch any candidate for "${pRaw}"`;
        console.warn(msg);
        setAnimationError(msg);
        return '';
    };

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setAnimationError('');
            if (!showCharacterExpanded || !selectedCharacter) {
                if (mounted) setAnimationUrl('');
                return;
            }
            console.debug('SkillEditorMobile: loading animation for', selectedCharacter.id, selectedCharacter.animation);
            // try main animation field first
            const raw = (selectedCharacter.animation || '').toString().trim();
            if (raw) {
                const url = await fetchUrlForPath(raw);
                if (mounted && url) { setAnimationUrl(url); return; }
            }
            // fallback: try transformAnimations array or defaultAnimation
            const ta = selectedCharacter.transformAnimations || selectedCharacter.transformTempAnimations || [];
            if (Array.isArray(ta) && ta.length > 0) {
                for (const p of ta) {
                    console.debug('SkillEditorMobile: trying transform animation', p);
                    const url = await fetchUrlForPath(p);
                    if (mounted && url) { setAnimationUrl(url); return; }
                }
            }
            // last resort: no animation found
            if (mounted) setAnimationUrl('');
        };
        load().catch((err) => { console.error('SkillEditorMobile: animation load failed', err); if (mounted) setAnimationUrl(''); });
        return () => { mounted = false; };
    }, [showCharacterExpanded, selectedCharacter]);

    useEffect(() => {
        setNameValue(skill?.name || '');
        setIsEditingName(false);
    }, [selectedId]);

    // show the existing LevelUp overlay when this skill moves from <100 to >=100
    useEffect(() => {
        const prev = prevSkillProgressRef.current;
        const now = skill?.progress ?? null;
        if (typeof prev === 'number' && typeof now === 'number' && prev < 100 && now >= 100) {
            setShowLevelToast(true);
        }
        prevSkillProgressRef.current = typeof now === 'number' ? now : prevSkillProgressRef.current;
    }, [skill?.progress]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            try { nameInputRef.current.focus(); nameInputRef.current.select(); } catch (e) { /* ignore */ }
        }
    }, [isEditingName]);

    // Recursive tree helpers to modify nested subskills and persist via updateSubskill
    const modifyNodeRecursive = (node: any, targetId: string, updater: (n: any) => any): [any, boolean] => {
        if (node.id === targetId) return [updater(node), true];
        if (!Array.isArray(node.subskills) || node.subskills.length === 0) return [node, false];
        let changed = false;
        const nextChildren = node.subskills.map((child: any) => {
            const [cn, cchanged] = modifyNodeRecursive(child, targetId, updater);
            if (cchanged) changed = true;
            return cn;
        });
        if (changed) return [{ ...node, subskills: nextChildren }, true];
        return [node, false];
    };

    const updateNodeById = (targetId: string, updater: (n: any) => any) => {
        if (!skill) return;
        const topSubs = skill.subskills || [];
        for (const top of topSubs) {
            const [modifiedTop, changed] = modifyNodeRecursive(top, targetId, updater);
            if (changed) {
                if (targetId === top.id) {
                    // top node itself was updated -- send only the changed fields
                    const updates: any = {};
                    for (const k of Object.keys(modifiedTop)) {
                        if (k === 'id') continue;
                        const before = (top as any)[k];
                        const after = (modifiedTop as any)[k];
                        try {
                            if (JSON.stringify(before) !== JSON.stringify(after)) updates[k] = after;
                        } catch (e) {
                            if (before !== after) updates[k] = after;
                        }
                    }
                    if (Object.keys(updates).length === 0) {
                        // nothing changed
                    } else {
                        updateSubskill && updateSubskill(skill.id, top.id, updates);
                    }
                } else {
                    // only nested subtree changed -- update the parent's subskills array
                    updateSubskill && updateSubskill(skill.id, top.id, { subskills: modifiedTop.subskills });
                }
                break;
            }
        }
    };

    const addNestedUnder = (parentId: string) => {
        const newSub = { id: `sub_${Date.now()}`, name: 'New Subskill', progress: 0 };
        updateNodeById(parentId, (n) => ({ ...n, subskills: Array.isArray(n.subskills) ? [newSub, ...n.subskills] : [newSub] }));
    };

    const removeNestedById = (targetId: string) => {
        if (!skill) return;
        // if target is a top-level subskill, delegate to deleteSubskill
        if ((skill.subskills || []).some((s: any) => s.id === targetId)) {
            deleteSubskill && deleteSubskill(skill.id, targetId);
            return;
        }
        // otherwise, find the top-level ancestor and remove target from its subtree
        const topSubs = skill.subskills || [];
        for (const top of topSubs) {
            const removeRecursive = (node: any, tid: string): [any, boolean] => {
                if (!Array.isArray(node.subskills) || node.subskills.length === 0) return [node, false];
                let changed = false;
                const next = [] as any[];
                for (const child of node.subskills) {
                    if (child.id === tid) { changed = true; continue; }
                    const [cn, cchanged] = removeRecursive(child, tid);
                    if (cchanged) changed = true;
                    next.push(cn);
                }
                if (changed) return [{ ...node, subskills: next }, true];
                return [node, false];
            };
            const [modifiedTop, changed] = removeRecursive(top, targetId);
            if (changed) {
                updateSubskill && updateSubskill(skill.id, top.id, { subskills: modifiedTop.subskills });
                break;
            }
        }
    };

    // Recursive renderer for subskill nodes
    const RecursiveSub: React.FC<{ node: any; isTop?: boolean }> = ({ node, isTop = false }) => {
        const [editingNameLocal, setEditingNameLocal] = useState(false);
        const [nameLocal, setNameLocal] = useState(node.name || '');
        const [editingProgressLocal, setEditingProgressLocal] = useState(false);
        const [progressLocal, setProgressLocal] = useState<number>(node.progress ?? 0);

        useEffect(() => {
            setNameLocal(node.name || '');
        }, [node.name]);
        useEffect(() => { setProgressLocal(node.progress ?? 0); }, [node.progress]);

        return (
            <div key={node.id} className="p-3 border rounded">
                <div className="flex items-center gap-2 mb-2">
                    {editingNameLocal ? (
                        <input
                            value={nameLocal}
                            onChange={(e) => setNameLocal(e.target.value)}
                            onBlur={() => { updateNodeById(node.id, (n) => ({ ...n, name: nameLocal })); setEditingNameLocal(false); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setEditingNameLocal(false); setNameLocal(node.name || ''); } }}
                            className="flex-1 border rounded px-2 py-1"
                        />
                    ) : (
                        <div className="flex-1" onClick={() => setEditingNameLocal(true)}>
                            <div className="text-sm font-medium truncate cursor-text border border-transparent hover:border-cyan-300 rounded px-2 py-1">{node.name}</div>
                        </div>
                    )}
                    {editingProgressLocal ? (
                        <div className="flex items-center gap-2">
                            <button disabled={controlsDisabled} onClick={() => { const next = clamp((node.progress ?? progressLocal) - 10); setProgressLocal(next); updateNodeById(node.id, (n) => ({ ...n, progress: next })); }} className="px-2 py-1 bg-gray-100 rounded text-sm">−</button>
                            <input
                                type="number"
                                value={String(progressLocal ?? 0)}
                                onChange={(e) => setProgressLocal(clamp(Number(e.target.value)))}
                                onBlur={() => { updateNodeById(node.id, (n) => ({ ...n, progress: clamp(progressLocal) })); setEditingProgressLocal(false); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setEditingProgressLocal(false); setProgressLocal(node.progress ?? 0); } }}
                                className="w-20 border rounded px-2 py-1"
                            />
                            <button disabled={controlsDisabled} onClick={() => { const next = clamp((node.progress ?? progressLocal) + 10); setProgressLocal(next); updateNodeById(node.id, (n) => ({ ...n, progress: next })); }} className="px-2 py-1 bg-gray-100 rounded text-sm">+</button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button disabled={controlsDisabled} onClick={() => updateNodeById(node.id, (n) => ({ ...n, progress: clamp((n.progress ?? 0) - 10) }))} className="px-2 py-1 bg-gray-100 rounded text-sm">−</button>
                            <div onClick={() => setEditingProgressLocal(true)} className="w-20 text-sm text-gray-700 cursor-text text-center">{Math.round(node.progress ?? progressLocal)}%</div>
                            <button disabled={controlsDisabled} onClick={() => updateNodeById(node.id, (n) => ({ ...n, progress: clamp((n.progress ?? 0) + 10) }))} className="px-2 py-1 bg-gray-100 rounded text-sm">+</button>
                        </div>
                    )}
                    <button onClick={() => { if (isTop) { deleteSubskill && deleteSubskill(skill.id, node.id); } else { removeNestedById(node.id); } }} className="px-2 py-1 bg-red-100 text-red-600 rounded">✕</button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
                        <div className="h-2 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, node.progress ?? 0)}%`, backgroundColor: dataColor(node.progress ?? 0) }} />
                    </div>
                    <button onClick={() => addNestedUnder(node.id)} className="px-2 py-1 bg-gray-100 rounded text-sm">Add nested</button>
                </div>
                {Array.isArray(node.subskills) && node.subskills.length > 0 && (
                    <div className="mt-3 space-y-2 pl-3">
                        {node.subskills.map((n: any) => (
                            <RecursiveSub key={n.id} node={n} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (!skills || (skills.length === 0)) return null;

    const dataColor = (p: number) => {
        if (p < 30) return '#8b0000';
        if (p < 50) return '#ff0000';
        if (p < 65) return '#ff8c00';
        if (p < 80) return '#ffd700';
        if (p < 90) return '#22c55e';
        return '#06b6d4';
    };

    return (
        <div className="fixed inset-0 z-50 bg-white overflow-auto p-4 lg:hidden" onClick={(e) => e.stopPropagation()}>
            <LevelUpOverlay show={showLevelToast} onDone={() => setShowLevelToast(false)} className="z-50" />
            <div className="mb-3">
                <div className="text-sm text-cyan-700 cursor-pointer mb-2" onClick={() => setShowCharacterExpanded(prev => !prev)}>{showCharacterExpanded ? 'Hide character' : 'Show character'}</div>
                {showCharacterExpanded && selectedCharacter && (
                    <div className="mb-3">
                        <div className="mb-3">
                            <CharacterSelector selectedCharacter={selectedCharacter} animationUrl={animationUrl} controlsDisabled={controlsDisabled} onCycle={() => { }} />
                            {animationError && (
                                <div className="text-xs text-red-600 mt-2">Preview error: {animationError}</div>
                            )}
                        </div>
                        <HPPanel hp={selectedCharacter.hp ?? 0} onModifyHp={(d: number) => {
                            if (!selectedCharacter) return;
                            const updated = { ...selectedCharacter, hp: Math.max(0, Math.min(100, (selectedCharacter.hp ?? 0) + d)) } as any;
                            setUserCharacters(prev => ({ ...prev, [updated.id]: updated }));
                            saveCharacter(updated).catch(console.error);
                        }} controlsDisabled={controlsDisabled} smallName={selectedCharacter.name} displayName={selectedCharacter.playerName ?? selectedCharacter.name} />
                        <XPPanel selectedCharacter={selectedCharacter} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} controlsDisabled={controlsDisabled} />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between mb-4">
                <button onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined') (window as any).__skillEditorJustClosed = Date.now(); onClose && onClose(); }} className="text-sm text-gray-600">Close</button>
                <div className="text-lg font-semibold">Edit Skill</div>
                <div className="flex items-center gap-2">
                    {typeof (addSkill) === 'function' && <button onClick={(e) => { e.stopPropagation(); addSkill('New Skill'); }} className="px-2 py-1 bg-cyan-500 text-white rounded text-sm">+ Skill</button>}
                    <button onClick={(e) => { e.stopPropagation(); if (typeof window !== 'undefined') (window as any).__skillEditorJustClosed = Date.now(); onClose && onClose(); }} className="text-sm text-blue-600">Done</button>
                </div>
            </div>
            <div className="space-y-4">
                <div>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="w-full border rounded px-2 py-1" />
                    <div className="mt-2 max-h-40 overflow-auto">
                        {(skills || []).filter((s: any) => !query || (s.name || '').toLowerCase().includes(query.toLowerCase())).map((s: any) => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedId(s.id)}
                                className={`w-full text-left p-2 rounded border border-gray-200 hover:border-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-300 ${s.id === selectedId ? 'bg-gray-100' : ''}`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>

                {skill && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                                {isEditingName ? (
                                    <input
                                        ref={nameInputRef}
                                        value={nameValue}
                                        onChange={(e) => setNameValue(e.target.value)}
                                        onBlur={() => { if (onRename && skill) onRename(skill.id, nameValue.trim()); setIsEditingName(false); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setIsEditingName(false); setNameValue(skill.name || ''); } }}
                                        className="w-full font-semibold text-lg border rounded px-2 py-1"
                                    />
                                ) : (
                                    <div onClick={() => setIsEditingName(true)} className="w-full font-semibold text-lg px-2 py-1 cursor-text border border-transparent hover:border-cyan-300 rounded">{skill.name || ''}</div>
                                )}
                            </div>
                            <div />
                        </div>

                        <div>
                            <label className="text-xs text-gray-500">Progress</label>
                            <div className="mt-2">
                                <div className="w-full h-3 bg-gray-200 rounded overflow-hidden">
                                    <div className="h-3 transition-all duration-700 ease-out" style={{ width: `${Math.min(100, skill.progress ?? 0)}%`, backgroundColor: dataColor(skill.progress ?? 0) }} />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    {skill.type === 'data' && Array.isArray(skill.subskills) && skill.subskills.length > 0 ? (
                                        // show computed average and disable direct editing
                                        <>
                                            <div className="w-28 border rounded px-2 py-1 bg-gray-50 text-sm text-gray-700 text-center">{computeAverageFromSkill(skill)}%</div>
                                            <div className="text-sm text-gray-600">{Math.round(computeAverageFromSkill(skill))}%</div>
                                            {computeAverageFromSkill(skill) >= 100 && !(skill.type === 'level' || skill.levelCount) && (
                                                <button onClick={() => onLevelUp && onLevelUp(skill.id)} className="ml-auto px-3 py-1 bg-emerald-500 text-white rounded text-sm">Level Up</button>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <button disabled={controlsDisabled} onClick={() => updateSkill && updateSkill(skill.id, clamp((skill.progress ?? 0) - 10))} className="px-2 py-1 bg-gray-100 rounded text-sm">−</button>
                                                <input type="number" defaultValue={String(skill.progress ?? 0)} onBlur={(e) => updateSkill && updateSkill(skill.id, Math.max(0, Math.min(100, Number(e.target.value))))} className="w-28 border rounded px-2 py-1" />
                                                <button disabled={controlsDisabled} onClick={() => updateSkill && updateSkill(skill.id, clamp((skill.progress ?? 0) + 10))} className="px-2 py-1 bg-gray-100 rounded text-sm">+</button>
                                                <div className="text-sm text-gray-600">{Math.round(skill.progress ?? 0)}%</div>
                                                {skill.progress >= 100 && !(skill.type === 'level' || skill.levelCount) && (
                                                    <button onClick={() => onLevelUp && onLevelUp(skill.id)} className="ml-auto px-3 py-1 bg-emerald-500 text-white rounded text-sm">Level Up</button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="flex items-center justify-between">
                                <div className="font-medium">Subskills</div>
                                <button onClick={() => addSubskill && addSubskill(skill.id, 'New Subskill')} className="px-3 py-1 bg-gray-100 rounded text-sm">Add</button>
                            </div>

                            <div className="mt-3 space-y-3">
                                {(skill.subskills || []).map((ss: any) => (
                                    <RecursiveSub key={ss.id} node={ss} isTop={true} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillEditorMobile;
