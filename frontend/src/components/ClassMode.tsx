import React, { useState, useRef } from "react";
import { isAdmin } from '../utils/adminConfig';
import ClassModeSkills from "./ClassModeSkills";
import LevelUpOverlay from "./LevelUpOverlay";
import TrainingMode from "./training/TrainingMode";
import { PuzzleMode } from "./puzzle/PuzzleMode";
import { ColoringMode } from "./coloring/ColoringMode";
import LessonsMode from "./lessons/LessonsMode";
import ClassModeStatsGraph from "./ClassModeStatsGraph";
import GoalMode from "./GoalMode";
import GroupSkillImportDialog from "./GroupSkillImportDialog";
import type { GroupSkillImportCandidate } from "./GroupSkillImportDialog";
import { fetchAnimUrl } from "../utils/storageUtils";
import { Character } from "../types/character";
import { totalXpForLevel, xpThreshold } from "../utils/xpUtils";
import { addUserCharacter, getUserCharacter } from "../services/characterService";
import { getCommonGroupSkills, getMissingGroupSkills, importMissingGroupSkills } from "../utils/groupSkillImport";
import RecalculateTotalXpButton from "./RecalculateTotalXpButton";

const makeSkillKey = (charId: string, skillId: string) => `${charId}_${skillId}`;

// Draft shape for the batch-add skill form: each subskill can itself carry nested subskills.
type SubskillDraft = { name: string; subskills: SubskillDraft[] };

// Renders a character's animation paused on its first frame instead of autoplaying it.
// Used anywhere ClassMode shows a lightweight preview (base-character picker, selected
// character cards) so selecting many characters doesn't play many videos at once.
const StillFrame: React.FC<{ url?: string; className?: string }> = ({ url, className }) => {
    if (!url) return <div className={`${className ?? 'w-full h-full'} flex items-center justify-center text-[10px] text-gray-400`}>No preview</div>;
    return (
        <video
            src={url}
            muted
            playsInline
            preload="metadata"
            onLoadedData={(e) => { e.currentTarget.currentTime = 0.05; }}
            className={`${className ?? 'w-full h-full'} object-cover pointer-events-none`}
        />
    );
};

interface Props {
    uid?: string | null;
    characters: Character[];
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    updateSkill: (skillId: string, progress?: number, mastered?: boolean, name?: string, notes?: string) => void;
    onClose: () => void;
    controlsDisabled: boolean;
    navigateToCharacter?: (id: string) => void;
}

const ClassMode: React.FC<Props> = ({ uid, characters, userCharacters, setUserCharacters, saveCharacter, updateSkill, onClose, controlsDisabled, navigateToCharacter }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [skillName, setSkillName] = useState("");
    const [skillType] = useState<'list' | 'completion' | 'data' | 'level'>('data');
    const [subskillsDraft, setSubskillsDraft] = useState<SubskillDraft[]>([]);

    const [animUrls, setAnimUrls] = useState<Record<string, string>>({});
    const [animLoading, setAnimLoading] = useState<Record<string, boolean>>({});
    const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});
    const [editingSkills, setEditingSkills] = useState<Record<string, { name: string }>>({});
    const [showAddSub, setShowAddSub] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [characterSort, setCharacterSort] = useState<'default' | 'level' | 'totalXp'>('default');
    const [groupFilter, setGroupFilter] = useState('');
    const [groupAssignment, setGroupAssignment] = useState('');
    const [xpAwardAmount, setXpAwardAmount] = useState('10');
    const [hpAwardAmount, setHpAwardAmount] = useState(10);
    const [xpAnimatingFull, setXpAnimatingFull] = useState<Record<string, boolean>>({});
    const [xpLevelToast, setXpLevelToast] = useState<Record<string, boolean>>({});
    const xpAnimTimeouts = useRef<Record<string, number[]>>({});
    const [transformReadyList, setTransformReadyList] = useState<string[]>([]);
    const [skippedTransforms, setSkippedTransforms] = useState<string[]>([]);
    const [applyConfirm, setApplyConfirm] = useState<number | null>(null);
    const applyConfirmTimeout = useRef<number | null>(null);
    const [xpAwardConfirm, setXpAwardConfirm] = useState<{ amount: number; count: number } | null>(null);
    const xpAwardConfirmTimeout = useRef<number | null>(null);
    const [hpAwardConfirm, setHpAwardConfirm] = useState<string | null>(null);
    const hpAwardConfirmTimeout = useRef<number | null>(null);
    const [groupAssignConfirm, setGroupAssignConfirm] = useState<{ group: string; names: string[] } | null>(null);
    const [pendingGroupSkillImport, setPendingGroupSkillImport] = useState<{ group: string; candidates: GroupSkillImportCandidate[] } | null>(null);
    const groupAssignConfirmTimeout = useRef<number | null>(null);
    const [showTraining, setShowTraining] = useState(false);
    const [showPuzzle, setShowPuzzle] = useState(false);
    const [showColoring, setShowColoring] = useState(false);
    const [showLessons, setShowLessons] = useState(false);
    const [showStatsGraph, setShowStatsGraph] = useState(false);
    const [showGoal, setShowGoal] = useState(false);
    const [showAddCharacter, setShowAddCharacter] = useState(false);
    const [newCharacterName, setNewCharacterName] = useState('');
    const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
    const [baseStillUrls, setBaseStillUrls] = useState<Record<string, string>>({});
    const [characterCreationConfirm, setCharacterCreationConfirm] = useState<string | null>(null);
    const characterCreationConfirmTimeout = useRef<number | null>(null);
    const [groupSkillImportConfirm, setGroupSkillImportConfirm] = useState<string | null>(null);
    const groupSkillImportConfirmTimeout = useRef<number | null>(null);

    // Minimal local helpers (simplified placeholders so ClassMode compiles)
    const applySkillToSelected = async () => {
        if (!skillName.trim() || selected.length === 0) return;
        const now = Date.now();
        const createdAt = now;
        const buildSubs = (drafts: SubskillDraft[], path: number[] = []): any[] =>
            drafts.map((s, i) => {
                const p = [...path, i];
                const sub: any = { id: `${now}_${p.join('_')}_${Math.random().toString(36).slice(2, 4)}`, name: s.name.trim() || `Subskill ${p.map(n => n + 1).join('.')}`, progress: 0, mastered: false, createdAt };
                const children = buildSubs(s.subskills ?? [], p);
                if (children.length > 0) sub.subskills = children;
                return sub;
            });
        const newSkillTemplate = (charId: string) => {
            const skillId = `${now}_${Math.random().toString(36).slice(2, 6)}`;
            const subs = buildSubs(subskillsDraft || []);
            const base: any = { id: skillId, name: skillName.trim() || 'New Skill', type: skillType, subskills: subs, createdAt };
            if (skillType !== 'data') base.progress = 0;
            return base;
        };

        for (const charId of selected) {
            const uc = userCharacters[charId] ?? (characters.find((c: any) => c.id === charId) || {} as any);
            const newSkill = newSkillTemplate(charId);
            const updated = { ...uc, skills: [newSkill, ...(uc.skills ?? [])] };
            setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
            try { await saveCharacter(updated); } catch (e) { console.error(e); }
        }

        // clear form
        setSkillName('');
        setSubskillsDraft([]);
        // show confirmation
        if (applyConfirmTimeout.current) window.clearTimeout(applyConfirmTimeout.current);
        setApplyConfirm(selected.length);
        applyConfirmTimeout.current = window.setTimeout(() => setApplyConfirm(null), 3000) as unknown as number;

    };

    // Include base characters plus any per-user-only characters from `userCharacters`.
    const allChars = (() => {
        const base = characters || [];
        const extra = Object.values(userCharacters || {}).filter((u: any) => !base.find((b: any) => b.id === u.id));
        return [...base, ...extra];
    })();
    const characterGroups = Array.from(new Set(Object.values(userCharacters)
        .map((character: any) => character.characterGroup?.trim())
        .filter(Boolean))) as string[];

    const assignGroupToSelected = async () => {
        const group = groupAssignment.trim();
        if (!group || selected.length === 0) return;
        const updates = selected
            .map(characterId => userCharacters[characterId])
            .filter(Boolean)
            .map((character: any) => ({ ...character, characterGroup: group }));
        const movingIds = new Set(updates
            .filter((character: any) => (userCharacters[character.id]?.characterGroup || '').trim() !== group)
            .map((character: any) => character.id));
        setUserCharacters(prev => ({
            ...prev,
            ...Object.fromEntries(updates.map(character => [character.id, character])),
        }));
        await Promise.all(updates.map(character => saveCharacter(character).catch(console.error)));
        const importCandidates: GroupSkillImportCandidate[] = updates.flatMap((character: any) => {
            if (!movingIds.has(character.id)) return [];
            const peers = Object.values(userCharacters).filter((peer: any) =>
                peer.id !== character.id &&
                (peer.characterGroup || '').trim() === group &&
                (!movingIds.has(peer.id) || (peer.characterGroup || '').trim() === group)
            );
            const missingSkills = getMissingGroupSkills(character, getCommonGroupSkills(peers));
            return missingSkills.length > 0 ? [{
                characterId: character.id,
                characterName: character.playerName || character.name || character.id,
                skills: missingSkills,
            }] : [];
        });
        if (importCandidates.length > 0) setPendingGroupSkillImport({ group, candidates: importCandidates });
        const names = updates.map((character: any) => character.playerName || character.name || character.id);
        if (groupAssignConfirmTimeout.current) window.clearTimeout(groupAssignConfirmTimeout.current);
        setGroupAssignConfirm({ group, names });
        groupAssignConfirmTimeout.current = window.setTimeout(() => setGroupAssignConfirm(null), 3000) as unknown as number;
        setGroupAssignment('');
    };

    const importSkillsForGroupCandidates = async () => {
        if (!pendingGroupSkillImport) return;
        const group = pendingGroupSkillImport.group;
        const updates = pendingGroupSkillImport.candidates.flatMap(candidate => {
            const current = userCharacters[candidate.characterId];
            if (!current) return [];
            const withGroup = { ...current, characterGroup: group };
            const updated = importMissingGroupSkills(withGroup, candidate.skills);
            const importedCount = (updated.skills?.length ?? 0) - (current.skills?.length ?? 0);
            return importedCount > 0 ? [{ character: updated, candidate, importedCount }] : [];
        });
        if (updates.length > 0) {
            setUserCharacters(prev => ({
                ...prev,
                ...Object.fromEntries(updates.map(({ character }) => [character.id, character])),
            }));
            if (groupAssignConfirmTimeout.current) window.clearTimeout(groupAssignConfirmTimeout.current);
            setGroupAssignConfirm(null);
            const results = await Promise.allSettled(updates.map(({ character }) => saveCharacter(character)));
            const summaries = updates.flatMap((update, index) => {
                const result = results[index];
                if (result.status === 'rejected') {
                    console.error('Failed to save imported group skills', result.reason);
                    return [];
                }
                return [`${update.importedCount} skill${update.importedCount === 1 ? '' : 's'} imported for ${update.candidate.characterName}`];
            });
            if (summaries.length > 0) {
                if (groupSkillImportConfirmTimeout.current) window.clearTimeout(groupSkillImportConfirmTimeout.current);
                setGroupSkillImportConfirm(summaries.join('; '));
                groupSkillImportConfirmTimeout.current = window.setTimeout(() => setGroupSkillImportConfirm(null), 3000) as unknown as number;
            }
        }
        setPendingGroupSkillImport(null);
    };

    const createCharacter = async () => {
        const name = newCharacterName.trim();
        const base = characters.find((c: any) => c.id === selectedBaseId);
        if (!uid || !name || !base) return;

        try {
            const payload = {
                name: (base as any).name || base.id,
                playerName: name,
                xp: 0,
                animation: (base as any).animation ?? (base as any).defaultAnimation,
                level: 1,
                hp: 100,
                maxHp: 100,
                ownerUid: uid,
                skills: [],
                createdAt: Date.now(),
            } as any;
            const newId = await addUserCharacter(uid, payload);
            const fresh = await getUserCharacter(uid, newId);
            const newCharacter = fresh ? ({ id: newId, ...fresh } as any) : ({ id: newId, ...payload } as any);
            setUserCharacters(prev => ({ ...prev, [newId]: newCharacter }));
            setSelected(prev => [...prev, newId]);
            setShowAddCharacter(false);
            setNewCharacterName('');
            setSelectedBaseId(null);
            if (characterCreationConfirmTimeout.current) window.clearTimeout(characterCreationConfirmTimeout.current);
            setCharacterCreationConfirm(`${name} created`);
            characterCreationConfirmTimeout.current = window.setTimeout(() => setCharacterCreationConfirm(null), 3000) as unknown as number;
        } catch (error) {
            console.error('Error creating character from Class Mode', error);
            alert('Could not create character');
        }
    };

    // load animation URLs for all selected characters (sequential, on-demand)
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!selected || selected.length === 0) return;
            for (const id of selected) {
                if (cancelled) return;
                if (animUrls[id] || animLoading[id]) continue;
                const ch = allChars.find((a: any) => a.id === id);
                const uc = userCharacters[id] ?? ch ?? {};
                const animPath = (uc && (uc.animation || uc.defaultAnimation)) || ch?.defaultAnimation || ch?.animation;
                if (!animPath) {
                    setAnimUrls(prev => ({ ...prev, [id]: '' }));
                    continue;
                }
                try {
                    setAnimLoading(prev => ({ ...prev, [id]: true }));
                    const url = await fetchAnimUrl(animPath);
                    if (cancelled) return;
                    setAnimUrls(prev => ({ ...prev, [id]: url || '' }));
                } catch (e) {
                    setAnimUrls(prev => ({ ...prev, [id]: '' }));
                } finally {
                    setAnimLoading(prev => ({ ...prev, [id]: false }));
                }
                // slight delay to avoid firing large parallel requests
                await new Promise(res => setTimeout(res, 120));
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, userCharacters]);

    // Load still-frame preview URLs for the base-character picker when it opens
    React.useEffect(() => {
        if (!showAddCharacter) return;
        let cancelled = false;
        (async () => {
            for (const base of characters) {
                if (cancelled) return;
                if (!base.id || baseStillUrls[base.id]) continue;
                const animPath = (base as any).animation ?? (base as any).defaultAnimation;
                const url = animPath ? await fetchAnimUrl(animPath).catch(() => '') : '';
                if (!cancelled) setBaseStillUrls(prev => ({ ...prev, [base.id as string]: url || '' }));
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showAddCharacter, characters]);

    // cleanup XP animation timeouts on unmount
    React.useEffect(() => {
        return () => {
            for (const key of Object.keys(xpAnimTimeouts.current)) {
                for (const t of xpAnimTimeouts.current[key] || []) window.clearTimeout(t);
            }
        };
    }, []);

    // Characters belonging to the currently selected group filter (or all characters if no filter).
    const groupChars = groupFilter
        ? allChars.filter((character: any) => userCharacters[character.id]?.characterGroup?.trim() === groupFilter)
        : allChars;

    // Search matches take priority; selected non-matches stay ahead of the remaining characters.
    const displayChars = (() => {
        const selectedCharacters = (selected || []).map(id => groupChars.find((character: any) => character.id === id)).filter(Boolean) as any[];
        const selectedIds = new Set(selected || []);
        const sortCharacters = (characters: any[]) => {
            if (characterSort === 'default') return characters;

            return [...characters].sort((left: any, right: any) => {
                const leftCharacter = userCharacters[left.id] ?? left ?? {};
                const rightCharacter = userCharacters[right.id] ?? right ?? {};
                const leftLevel = typeof leftCharacter.level === 'number' ? leftCharacter.level : (left.level ?? 1);
                const rightLevel = typeof rightCharacter.level === 'number' ? rightCharacter.level : (right.level ?? 1);

                if (characterSort === 'level') return rightLevel - leftLevel;

                const leftXp = typeof leftCharacter.xp === 'number' ? leftCharacter.xp : (left.xp ?? 0);
                const rightXp = typeof rightCharacter.xp === 'number' ? rightCharacter.xp : (right.xp ?? 0);
                const leftTotalXp = typeof leftCharacter.currencyXp === 'number'
                    ? Math.max(0, Math.floor(leftCharacter.currencyXp))
                    : totalXpForLevel(leftLevel, leftXp);
                const rightTotalXp = typeof rightCharacter.currencyXp === 'number'
                    ? Math.max(0, Math.floor(rightCharacter.currencyXp))
                    : totalXpForLevel(rightLevel, rightXp);

                return rightTotalXp - leftTotalXp;
            });
        };
        const q = (searchTerm || '').trim().toLowerCase();
        if (!q) {
            if (characterSort !== 'default') return sortCharacters(groupChars);
            const remaining = groupChars.filter((character: any) => !selectedIds.has(character.id));
            return [...sortCharacters(selectedCharacters), ...sortCharacters(remaining)];
        }

        const matches = groupChars.filter((character: any) => {
            const userCharacter = userCharacters[character.id] ?? {};
            const display = ((userCharacter.playerName || userCharacter.name) || character.name || character.id || '').toString().toLowerCase();
            return display.includes(q);
        });
        const matchIds = new Set(matches.map((character: any) => character.id));
        const selectedNonMatches = selectedCharacters.filter((character: any) => !matchIds.has(character.id));
        const rest = groupChars.filter((character: any) => !selectedIds.has(character.id) && !matchIds.has(character.id));

        return [...sortCharacters(matches), ...sortCharacters(selectedNonMatches), ...sortCharacters(rest)];
    })();

    // compute transform-ready characters (do not auto-trigger transform here, just surface them)
    React.useEffect(() => {
        const ready: string[] = [];
        for (const ch of allChars) {
            if (skippedTransforms.includes(ch.id)) continue;
            const uc = userCharacters[ch.id] ?? ch ?? {};
            const transformIndex = typeof uc?.transformIndex === 'number' ? uc.transformIndex : 0;
            const thresholds = uc?.transformThresholds ?? [];
            const nextThreshold = thresholds[transformIndex];
            if (typeof nextThreshold === 'number' && (uc.level ?? ch.level ?? 0) >= nextThreshold) ready.push(ch.id);
        }
        setTransformReadyList(ready);
    }, [allChars, userCharacters, skippedTransforms]);

    const toggleSelectAll = () => {
        const groupIds = groupChars.map((c: any) => c.id);
        const allGroupSelected = groupIds.length > 0 && groupIds.every(id => selected.includes(id));
        if (allGroupSelected) setSelected(prev => prev.filter(id => !groupIds.includes(id)));
        else setSelected(prev => Array.from(new Set([...prev, ...groupIds])));
    };

    // Path-indexed helpers so the batch form supports nested subskill drafts.
    const updateDraftNodes = (list: SubskillDraft[], path: number[], fn: (nodes: SubskillDraft[], idx: number) => SubskillDraft[]): SubskillDraft[] => {
        if (path.length === 1) return fn(list, path[0]);
        return list.map((s, i) => i === path[0] ? { ...s, subskills: updateDraftNodes(s.subskills ?? [], path.slice(1), fn) } : s);
    };

    const updateSubskillDraft = (path: number[], patch: Partial<{ name: string }>) => {
        setSubskillsDraft(prev => updateDraftNodes(prev, path, (nodes, idx) => nodes.map((s, i) => i === idx ? { ...s, ...(patch as any) } : s)));
    };

    const removeSubskillDraft = (path: number[]) => {
        setSubskillsDraft(prev => updateDraftNodes(prev, path, (nodes, idx) => nodes.filter((_, i) => i !== idx)));
    };

    const addSubskillDraft = (path?: number[]) => {
        if (!path || path.length === 0) {
            setSubskillsDraft(prev => [...prev, { name: '', subskills: [] }]);
            return;
        }
        setSubskillsDraft(prev => updateDraftNodes(prev, path, (nodes, idx) => nodes.map((s, i) => i === idx ? { ...s, subskills: [...(s.subskills ?? []), { name: '', subskills: [] }] } : s)));
    };

    const renderSubskillDrafts = (drafts: SubskillDraft[], path: number[] = []): React.ReactNode => (
        <div className={path.length > 0 ? 'ml-4 mt-2 border-l-2 border-emerald-100 pl-2' : ''}>
            {drafts.map((ss, idx) => {
                const p = [...path, idx];
                return (
                    <div key={idx} className="mb-2">
                        <div className="flex items-center gap-2">
                            <input value={ss.name} onChange={e => updateSubskillDraft(p, { name: e.target.value })} placeholder={path.length === 0 ? 'Subskill name' : 'Nested subskill name'} className="flex-1 border rounded px-2 py-1" />
                            <button onClick={() => addSubskillDraft(p)} title="Add nested subskill" className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">+ Nested</button>
                            <button onClick={() => removeSubskillDraft(p)} className="px-2 py-1 bg-gray-200 rounded">Remove</button>
                        </div>
                        {ss.subskills.length > 0 && renderSubskillDrafts(ss.subskills, p)}
                    </div>
                );
            })}
        </div>
    );

    const changeHp = async (charId: string, delta: number) => {
        const ch = allChars.find((x: any) => x.id === charId) ?? {} as any;
        const uc = userCharacters[charId] ?? ch ?? {};
        const curHp = typeof uc.hp === 'number' ? uc.hp : (ch.hp ?? 100);
        const maxHp = typeof uc.maxHp === 'number' ? uc.maxHp : (ch.maxHp ?? 100);
        const newHp = Math.max(0, Math.min(maxHp, curHp + delta));
        const updated = { ...uc, hp: newHp };
        setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    // Used by TrainingMode to persist HP damage (absolute value, not delta)
    const setCharHp = async (charId: string, hp: number) => {
        const ch = allChars.find((x: any) => x.id === charId) ?? {} as any;
        const uc = userCharacters[charId] ?? ch ?? {};
        const updated = { ...uc, hp };
        setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
    };

    // change XP with level-up animation when crossing thresholds
    const awardXpToSelected = () => {
        const amount = Math.trunc(Number(xpAwardAmount));
        if (selected.length === 0 || !Number.isFinite(amount) || amount === 0) return;
        for (const charId of selected) changeXp(charId, amount);
        if (xpAwardConfirmTimeout.current) window.clearTimeout(xpAwardConfirmTimeout.current);
        setXpAwardConfirm({ amount, count: selected.length });
        xpAwardConfirmTimeout.current = window.setTimeout(() => setXpAwardConfirm(null), 3000) as unknown as number;
    };

    const awardXpToGroup = (group: string, points: number) => {
        const ids = allChars
            .filter((c: any) => (userCharacters[c.id]?.characterGroup || '').trim() === group)
            .map((c: any) => c.id);
        for (const id of ids) changeXp(id, points);
    };

    const goalCharacterOptions = allChars.map((c: any) => ({
        id: c.id,
        name: (userCharacters[c.id] && (userCharacters[c.id].playerName || userCharacters[c.id].name)) || c.name || c.id,
    }));

    const changeHpForSelected = (delta: number) => {
        if (selected.length === 0) return;
        const boundaryHp = delta < 0 ? 0 : 100;
        const eligibleCharacterIds = selected.filter(charId => {
            const ch = allChars.find((character: any) => character.id === charId) ?? {} as any;
            const uc = userCharacters[charId] ?? ch;
            const hp = typeof uc.hp === 'number' ? uc.hp : (ch.hp ?? 100);
            const maxHp = typeof uc.maxHp === 'number' ? uc.maxHp : (ch.maxHp ?? 100);
            return delta < 0 ? hp > 0 : hp < maxHp;
        });
        const cappedCount = selected.length - eligibleCharacterIds.length;

        for (const charId of eligibleCharacterIds) changeHp(charId, delta);

        const changedCount = eligibleCharacterIds.length;
        const action = delta < 0 ? 'subtracted from' : 'added to';
        const changedMessage = changedCount > 0
            ? `${Math.abs(delta)} HP ${action} ${changedCount} character${changedCount !== 1 ? 's' : ''}.`
            : '';
        const cappedMessage = cappedCount > 0
            ? `${cappedCount} character${cappedCount !== 1 ? 's' : ''} already ${cappedCount === 1 ? 'has' : 'have'} ${boundaryHp} HP.`
            : '';

        if (hpAwardConfirmTimeout.current) window.clearTimeout(hpAwardConfirmTimeout.current);
        setHpAwardConfirm([cappedMessage, changedMessage].filter(Boolean).join(' '));
        hpAwardConfirmTimeout.current = window.setTimeout(() => setHpAwardConfirm(null), 3000) as unknown as number;
    };

    const changeXp = async (charId: string, delta: number) => {
        const ch = allChars.find((x: any) => x.id === charId) ?? {} as any;
        const uc = userCharacters[charId] ?? ch ?? {};
        const curXp = typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0);
        const curLevel = typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
        // keep spendable currencyXp (store balance) in sync with every XP award
        const existingCurrency = typeof uc.currencyXp === 'number'
            ? Math.max(0, Math.floor(uc.currencyXp))
            : totalXpForLevel(curLevel, curXp);
        const newCurrency = existingCurrency + delta;
        let tmpXp = curXp + delta;
        let tmpLevel = curLevel;
        let nextXP = xpThreshold(tmpLevel);
        // detect if we will level up
        if (tmpXp < nextXP) {
            // simple update, no animation
            const updated = { ...uc, xp: tmpXp, level: tmpLevel, currencyXp: newCurrency };
            setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
            try { await saveCharacter(updated); } catch (e) { console.error(e); }
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

        const runStep = (index: number, currentLevel: number, currentXpValue: number) => {
            // animate fill to 100%
            setXpAnimatingFull(prev => ({ ...prev, [charId]: true }));
            const t1 = window.setTimeout(async () => {
                // after showing full, advance level and set xp to leftover
                setXpAnimatingFull(prev => ({ ...prev, [charId]: false }));
                const newLevel = currentLevel + 1;
                const newXpVal = leftovers[index];
                const updated = { ...uc, xp: newXpVal, level: newLevel, currencyXp: newCurrency } as any;
                setUserCharacters((prev) => ({ ...prev, [charId]: updated }));
                try { await saveCharacter(updated); } catch (err) { console.error(err); }

                // show brief level toast
                setXpLevelToast(prev => ({ ...prev, [charId]: true }));
                const tToast = window.setTimeout(() => setXpLevelToast(prev => ({ ...prev, [charId]: false })), 900);
                xpAnimTimeouts.current[charId].push(tToast as unknown as number);

                // schedule next step or finish
                if (index + 1 < leftovers.length) {
                    const tNext = window.setTimeout(() => runStep(index + 1, newLevel, newXpVal), betweenDelay);
                    xpAnimTimeouts.current[charId].push(tNext as unknown as number);
                }
            }, fillDelay);
            xpAnimTimeouts.current[charId].push(t1 as unknown as number);
        };

        // start sequence
        runStep(0, curLevel, curXp);
    };


    const toggleEditSkill = (charId: string, skillId: string) => {
        const key = makeSkillKey(charId, skillId);
        setEditingSkills(prev => {
            const copy = { ...prev } as Record<string, { name: string }>;
            if (copy[key]) {
                delete copy[key];
                return copy;
            }
            const skill = (userCharacters[charId]?.skills || []).find((s: any) => s.id === skillId) || {};
            copy[key] = { name: skill.name || '' };
            return copy;
        });
    };

    const saveEditedSkill = async (charId: string, skillId: string) => {
        const key = makeSkillKey(charId, skillId);
        const draft = editingSkills[key];
        if (!draft) return;
        const uc = userCharacters[charId] ?? {};
        const skill = (uc.skills ?? []).find((s: any) => s.id === skillId) || {};
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, name: draft.name.trim() || s.name } : s) };
        setUserCharacters((prev: Record<string, any>) => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
        setEditingSkills(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
    };



    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-2 overflow-auto">
            {applyConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-indigo-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        Skill added to {applyConfirm} character{applyConfirm !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
            {xpAwardConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-blue-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        {xpAwardConfirm.amount} XP awarded to {xpAwardConfirm.count} character{xpAwardConfirm.count !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
            {hpAwardConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        {hpAwardConfirm}
                    </div>
                </div>
            )}
            {characterCreationConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once">
                        {characterCreationConfirm}
                    </div>
                </div>
            )}
            {groupSkillImportConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once text-center">
                        {groupSkillImportConfirm}
                    </div>
                </div>
            )}
            {groupAssignConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-cyan-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once text-center">
                        {groupAssignConfirm.names.join(', ')} assigned to group "{groupAssignConfirm.group}"
                    </div>
                </div>
            )}
            {pendingGroupSkillImport && (
                <GroupSkillImportDialog
                    group={pendingGroupSkillImport.group}
                    candidates={pendingGroupSkillImport.candidates}
                    onImport={() => { void importSkillsForGroupCandidates(); }}
                    onSkip={() => setPendingGroupSkillImport(null)}
                />
            )}
            {showAddCharacter && (
                <div className="fixed inset-0 z-[70] bg-black bg-opacity-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-sm">
                        <h3 className="text-lg font-semibold mb-3">Create Character</h3>
                        <p className="text-sm text-gray-600 mb-2">Choose a character</p>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {characters.map((base: any) => (
                                <button
                                    key={base.id}
                                    type="button"
                                    onClick={() => setSelectedBaseId(base.id)}
                                    className={`flex flex-col items-center gap-1 p-1 rounded border-2 transition ${
                                        selectedBaseId === base.id ? "border-amber-500 bg-amber-50" : "border-transparent hover:border-gray-300"
                                    }`}
                                >
                                    <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                                        <StillFrame url={baseStillUrls[base.id]} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 truncate max-w-[64px]">{base.name}</span>
                                </button>
                            ))}
                        </div>
                        <input
                            autoFocus
                            value={newCharacterName}
                            onChange={(event) => setNewCharacterName(event.target.value)}
                            onKeyDown={(event) => { if (event.key === 'Enter') createCharacter(); }}
                            placeholder="Player name"
                            className="w-full border rounded px-2 py-1 mb-3"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowAddCharacter(false); setSelectedBaseId(null); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                            <button onClick={createCharacter} disabled={!newCharacterName.trim() || !selectedBaseId} className="px-3 py-1 bg-amber-500 text-black rounded disabled:opacity-50">Create</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white w-full max-w-[95vw] rounded shadow-lg p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h3 className="text-xl font-bold">Class Mode</h3>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                        <button
                            onClick={() => { setNewCharacterName(''); setSelectedBaseId(null); setShowAddCharacter(true); }}
                            disabled={controlsDisabled}
                            className="px-3 py-1 bg-amber-500 text-black text-sm rounded disabled:opacity-50"
                        >
                            + Character
                        </button>
                        {isAdmin(uid) && (
                        <button
                            onClick={() => setShowPuzzle(true)}
                            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded transition text-sm font-semibold"
                        >
                            Puzzles
                        </button>
                        )}
                        {isAdmin(uid) && (
                        <button
                            onClick={() => setShowColoring(true)}
                            className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white rounded transition text-sm font-semibold"
                        >
                            Coloring
                        </button>
                        )}
                        <button
                            onClick={() => setShowLessons(true)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition text-sm font-semibold"
                        >
                            Lessons
                        </button>
                        <button
                            onClick={() => setShowGoal(true)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded transition text-sm font-semibold"
                        >
                            Goal
                        </button>
                        <button
                            onClick={() => setShowStatsGraph(true)}
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded transition text-sm font-semibold"
                        >
                            Graph
                        </button>
                        <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">Close</button>
                    </div>
                </div>

                <div className="mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <div>
                            <input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="Skill name to add to selected" className="w-full border rounded px-2 py-1" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <button onClick={applySkillToSelected} className="px-3 py-1 bg-emerald-500 text-white rounded">Apply to Selected ({selected.length})</button>
                            <button onClick={toggleSelectAll} className="px-3 py-1 bg-gray-200 rounded">{groupChars.length > 0 && groupChars.every((c: any) => selected.includes(c.id)) ? 'Deselect All' : 'Select All'}</button>
                        </div>
                    </div>

                    <div className="mb-3">
                        <div className="text-sm font-semibold mb-1">Subskills (use + Nested for sub-subskills)</div>
                        {renderSubskillDrafts(subskillsDraft)}
                        <div className="mt-2">
                            <button onClick={() => addSubskillDraft()} className="px-2 py-1 bg-emerald-500 text-white rounded text-sm">+ Subskill</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <input type="number" step={1} value={xpAwardAmount} onChange={(e) => setXpAwardAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') awardXpToSelected(); }} placeholder="XP" className="border rounded px-2 py-1 w-24" />
                        <button onClick={awardXpToSelected} disabled={selected.length === 0 || !Math.trunc(Number(xpAwardAmount))} className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50">Award XP to Selected ({selected.length})</button>
                       
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <select value={hpAwardAmount} onChange={(e) => setHpAwardAmount(Number(e.target.value))} className="border rounded px-2 py-1">
                            {[5, 10, 25, 50, 100].map(amount => <option key={amount} value={amount}>{amount} HP</option>)}
                        </select>
                        <button onClick={() => changeHpForSelected(-hpAwardAmount)} disabled={selected.length === 0 || controlsDisabled} className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50">Subtract HP from Selected ({selected.length})</button>
                        <button onClick={() => changeHpForSelected(hpAwardAmount)} disabled={selected.length === 0 || controlsDisabled} className="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50">Add HP to Selected ({selected.length})</button>
                    </div>


                    <div>
                        <div className="text-sm font-semibold mb-2">Characters</div>
                        <div className="mb-2 flex items-center gap-2">
                            <label htmlFor="class-mode-character-sort" className="text-sm text-gray-700">Sort</label>
                            <select
                                id="class-mode-character-sort"
                                value={characterSort}
                                onChange={event => setCharacterSort(event.target.value as 'default' | 'level' | 'totalXp')}
                                className="border rounded px-2 py-1 text-sm"
                            >
                                <option value="default">Selected first</option>
                                <option value="level">Level (high to low)</option>
                                <option value="totalXp">Total XP (high to low)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search characters..." className="w-full border rounded px-2 py-1" />
                            <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} className="w-full border rounded px-2 py-1">
                                <option value="">All character groups</option>
                                {characterGroups.map(group => <option key={group} value={group}>{group}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2 mb-2">
                            <input value={groupAssignment} onChange={event => setGroupAssignment(event.target.value)} list="class-mode-character-groups" placeholder="Group selected characters" className="flex-1 border rounded px-2 py-1" />
                            <datalist id="class-mode-character-groups">
                                {characterGroups.map(group => <option key={group} value={group} />)}
                            </datalist>
                            <button onClick={assignGroupToSelected} disabled={!groupAssignment.trim() || selected.length === 0} className="px-3 py-1 bg-cyan-500 text-white rounded disabled:opacity-50">Assign Group</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {displayChars.map((c: any) => (
                                <div key={c.id} className={`relative flex flex-col gap-2 border rounded px-2 py-1 ${selected.includes(c.id) ? 'ring-2 ring-emerald-300' : ''}`}>
                                    <LevelUpOverlay className="z-50" show={!!xpLevelToast[c.id]} onDone={() => setXpLevelToast(prev => ({ ...prev, [c.id]: false }))} />
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); navigateToCharacter?.(c.id); }}
                                        className="absolute top-1 right-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
                                        title="Open character dashboard"
                                        aria-label={`Open ${(userCharacters[c.id] && (userCharacters[c.id].playerName || userCharacters[c.id].name)) || c.name || c.id}'s dashboard`}
                                    >
                                        ↑
                                    </button>
                                    <div className="flex items-center justify-between cursor-pointer pr-10" onClick={() => {
                                        setSelected((prev: string[]) => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                                    }}>
                                        <div className="truncate">{(userCharacters[c.id] && (userCharacters[c.id].playerName || userCharacters[c.id].name)) || c.name || c.id}</div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setExpandedSkills(prev => ({ ...prev, [c.id]: !prev[c.id] })); }} aria-expanded={!!expandedSkills[c.id]} className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                {expandedSkills[c.id] ? '▾' : '▸'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Animation window + small HP/XP bars + level */}
                                    {(() => {
                                        const uc = userCharacters[c.id] ?? c;
                                        const hp = typeof uc.hp === 'number' ? uc.hp : (c.hp ?? 100);
                                        const maxHp = typeof uc.maxHp === 'number' ? uc.maxHp : (c.maxHp ?? 100);
                                        const hpPct = Math.max(0, Math.min(100, Math.round((hp / (maxHp || 1)) * 100)));
                                        const xp = typeof uc.xp === 'number' ? uc.xp : (c.xp ?? 0);
                                        const level = typeof uc.level === 'number' ? uc.level : (c.level ?? 1);
                                        const totalXp = typeof uc.currencyXp === 'number'
                                            ? Math.max(0, Math.floor(uc.currencyXp))
                                            : totalXpForLevel(level, xp);
                                        const nextLevelXP = xpThreshold(level);
                                        const xpPercent = Math.max(0, Math.min(100, Math.round((xp / Math.max(1, nextLevelXP)) * 100)));
                                        const animUrl = animUrls[c.id];
                                        return (
                                            <div className="mt-2">
                                                <div className="w-full bg-white border rounded overflow-hidden flex items-center justify-center relative">
                                                    {animLoading[c.id] ? (
                                                        <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                                                    ) : (animUrl && selected.includes(c.id)) ? (
                                                        <StillFrame url={animUrl} className="w-full h-40 " />
                                                    ) : (
                                                        <div className="text-xs text-gray-400 py-6">{selected.includes(c.id) ? 'No preview' : 'Click name to select'}</div>
                                                    )}
                                                </div>

                                                <div className="mt-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-xs text-gray-600">HP {hp}/{maxHp}</div>
                                                        <span className="text-xs font-normal text-cyan-700">Total XP: {totalXp}</span>
                                                        <div className="text-sm font-medium">Level {level} </div>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        <div className="flex-1 bg-red-100 rounded h-2 overflow-hidden">
                                                            <div className="h-2 transition-all duration-1000 ease-out" style={{ width: `${hpPct}%`, background: '#3ce6a2', willChange: 'width' }} />
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={(e) => { e.stopPropagation(); changeHp(c.id, -10); }} disabled={controlsDisabled} className="px-2 py-0.5 text-xs bg-gray-100 rounded">-</button>
                                                            <button onClick={(e) => { e.stopPropagation(); changeHp(c.id, 10); }} disabled={controlsDisabled} className="px-2 py-0.5 text-xs bg-gray-100 rounded">+</button>
                                                        </div>
                                                    </div>
                                                    <div onClick={(e) => { e.stopPropagation(); if (!controlsDisabled) changeXp(c.id, 25); }} title="Click to add 25 XP" className={`mt-1 w-full bg-blue-100 rounded h-2 overflow-hidden ${controlsDisabled ? '' : 'cursor-pointer'}`}>
                                                        <div className="h-2 transition-all duration-1000 ease-out" style={{ width: `${xpAnimatingFull[c.id] ? 100 : xpPercent}%`, background: '#0ea5e9', willChange: 'width', boxShadow: xpLevelToast[c.id] ? '0 0 10px rgba(14,165,233,0.6)' : undefined }} />
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1 text-right">{xp}/{nextLevelXP} XP</div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {expandedSkills[c.id] && (() => {
                                        const ucForSkills = userCharacters[c.id] ?? c;
                                        const charXp = typeof ucForSkills.xp === 'number' ? ucForSkills.xp : (c.xp ?? 0);
                                        const charLevel = typeof ucForSkills.level === 'number' ? ucForSkills.level : (c.level ?? 1);
                                        return (
                                            <ClassModeSkills charId={c.id} uc={ucForSkills} userCharacters={userCharacters} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} controlsDisabled={controlsDisabled}
                                                characterXp={charXp} characterLevel={charLevel} onAwardXp={(xp) => changeXp(c.id, xp)} />
                                        );
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Central transform navigator when any characters are ready */}
                    {transformReadyList.length > 0 && (
                        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-auto">
                            <div className="bg-black bg-opacity-40 absolute inset-0" onClick={() => { setSkippedTransforms(prev => [...prev, ...transformReadyList]); setTransformReadyList([]); }} />
                            <div className="relative bg-white rounded-lg p-6 shadow-lg z-50 max-w-md text-center">
                                <h3 className="text-lg font-bold mb-2">Transformation(s) Ready</h3>
                                <p className="text-sm text-gray-700 mb-4">One or more characters have reached a transformation level! Click to go to the character's page!</p>
                                <div className="flex flex-col gap-2 max-h-64 overflow-auto mb-4">
                                    {transformReadyList.map(id => {
                                        const ch = allChars.find((x: any) => x.id === id) || userCharacters[id] || { id };
                                        const display = ((userCharacters[id] && (userCharacters[id].playerName || userCharacters[id].name)) || ch.name || id);
                                        return (
                                            <button key={id} onClick={() => { if (typeof navigateToCharacter === 'function') navigateToCharacter(id); else { onClose(); } }} className="px-3 py-2 bg-emerald-500 text-white rounded">Go to {display}</button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => { setSkippedTransforms(prev => [...prev, ...transformReadyList]); setTransformReadyList([]); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 underline mt-1"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showTraining && (
                <TrainingMode
                    uid={uid}
                    allCharacters={allChars.map((ch: any) => {
                        const uc = userCharacters[ch.id] ?? ch ?? {};
                        const animPath = (uc.animation || uc.defaultAnimation) || ch?.defaultAnimation || ch?.animation;
                        const level = typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
                        const transformIdx = typeof uc.transformIndex === 'number' ? uc.transformIndex : (ch?.transformIndex ?? 0);
                        const formIdx = Math.min(transformIdx, 6); // 0 = base form, 1-6 = transforms
                        const actionAnims: string[] = uc.actionAnimations ?? ch?.actionAnimations ?? [];
                        const damageAnims: string[] = uc.damageAnimations ?? ch?.damageAnimations ?? [];
                        const defeatAnims: string[] = uc.defeatAnimations ?? ch?.defeatAnimations ?? [];
                        const woundedAnims: string[] = uc.woundedAnimations ?? ch?.woundedAnimations ?? [];
                        return {
                            id: ch.id,
                            name: uc.playerName || uc.name || ch?.name || ch.id,
                            hp: uc.hp ?? ch?.hp ?? 100,
                            maxHp: uc.maxHp ?? ch?.maxHp ?? 100,
                            xp: typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0),
                            level,
                            animUrl: animUrls[ch.id] || undefined,
                            animPath: animPath || undefined,
                            actionAnimPath: actionAnims[formIdx] || undefined,
                            damageAnimPath: damageAnims[formIdx] || undefined,
                            defeatAnimPath: defeatAnims[formIdx] || defeatAnims[0] || undefined,
                            woundedAnimPath: woundedAnims[formIdx] || woundedAnims[0] || undefined,
                            actionAnimations: actionAnims.length ? actionAnims : undefined,
                            damageAnimations: damageAnims.length ? damageAnims : undefined,
                            defeatAnimations: defeatAnims.length ? defeatAnims : undefined,
                            woundedAnimations: woundedAnims.length ? woundedAnims : undefined,
                            transformThresholds: (uc.transformThresholds ?? ch?.transformThresholds ?? []) as number[],
                            transformIndex: transformIdx,
                        };
                    })}
                    onAwardXP={changeXp}
                    onSetHp={setCharHp}
                    onNavigateToCharacter={navigateToCharacter}
                    onClose={() => setShowTraining(false)}
                />
            )}
            {showColoring && (
                <ColoringMode
                    uid={uid}
                    onClose={() => setShowColoring(false)}
                />
            )}
            {showLessons && (
                <LessonsMode onClose={() => setShowLessons(false)} />
            )}
            {showGoal && (
                <GoalMode
                    uid={uid}
                    onClose={() => setShowGoal(false)}
                    characterGroups={characterGroups}
                    characters={goalCharacterOptions}
                    onAwardGroupXp={awardXpToGroup}
                    onAwardCharacterXp={changeXp}
                />
            )}
            {showStatsGraph && (
                <ClassModeStatsGraph characters={groupChars} userCharacters={userCharacters} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} onClose={() => setShowStatsGraph(false)} />
            )}
            {showPuzzle && (
                <PuzzleMode
                    uid={uid}
                    allCharacters={allChars.map((ch: any) => {
                        const uc = userCharacters[ch.id] ?? ch ?? {};
                        const animPath = (uc.animation || uc.defaultAnimation) || ch?.defaultAnimation || ch?.animation;
                        const level = typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
                        return {
                            id: ch.id,
                            name: uc.playerName || uc.name || ch?.name || ch.id,
                            hp: uc.hp ?? ch?.hp ?? 100,
                            maxHp: uc.maxHp ?? ch?.maxHp ?? 100,
                            xp: typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0),
                            level,
                            animUrl: animUrls[ch.id] || undefined,
                            animPath: animPath || undefined,
                        };
                    })}
                    onAwardXP={changeXp}
                    onClose={() => setShowPuzzle(false)}
                />
            )}
        </div>
    );
};

export default ClassMode;
