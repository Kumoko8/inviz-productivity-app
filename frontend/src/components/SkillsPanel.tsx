import React, { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { isAdmin } from '../utils/adminConfig';
import ToggleArrow from './ToggleArrow';
import SkillItem from './SkillItem';
import SkillEditorMobile from './SkillEditorMobile';
// SkillMenu removed from panel header; rendered per-skill in SkillItem now
import { Skill } from '../types/character';
import { xpThreshold } from '../utils/xpUtils';

type Props = {
    selectedCharacter: any;
    controlsDisabled: boolean;
    showSkills: boolean;
    setShowSkills: Dispatch<SetStateAction<boolean>>;
    showAddSkillForm: boolean;
    setShowAddSkillForm: Dispatch<SetStateAction<boolean>>;
    newSkillName: string;
    setNewSkillName: Dispatch<SetStateAction<string>>;
    addSkill: (name?: string, opts?: { type?: string; amountTarget?: number }) => void;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    updateSkill: (
        id: string,
        progress?: number,
        mastered?: boolean,
        newName?: string,
        notes?: string,
        type?: string,
        levelCount?: number,
        extra?: any,
    ) => void;
    deleteSkill: (id: string) => void;
    addSubskill: (skillId: string, name: string) => void;
    updateSubskill: (skillId: string, subId: string, updates: any) => void;
    deleteSubskill: (skillId: string, subId: string) => void;
    // archiveMasteredSkills: () => void;
    // onArchiveSkill?: (skillId: string) => void;
    onPrioritizeSkill?: (skillId: string) => void;
    onColorChangeSkill?: (skillId: string, color: string) => void;
    duplicateSkill?: (skillId: string) => void;

    setShowClassMode: Dispatch<SetStateAction<boolean>>;
    setShowCalendar?: Dispatch<SetStateAction<boolean>>;
    setShowMap?: Dispatch<SetStateAction<boolean>>;
    setShowTraining?: Dispatch<SetStateAction<boolean>>;
    uid?: string | null;
};

// Sum of all levelCounts in a skill + all subskills recursively.
// Any level-up anywhere in the tree changes this value and unlocks Complete.
function sumLevels(node: any): number {
    return (node.levelCount ?? 1) +
        ((node.subskills ?? []) as any[]).reduce((acc: number, ss: any) => acc + sumLevels(ss), 0);
}

const SkillsPanel: React.FC<Props> = ({
    selectedCharacter,
    controlsDisabled,
    showSkills,
    setShowSkills,
    showAddSkillForm,
    setShowAddSkillForm,
    newSkillName,
    setNewSkillName,
    addSkill,
    setUserCharacters,
    saveCharacter,
    updateSkill,
    deleteSkill,
    addSubskill,
    updateSubskill,
    deleteSubskill,
    // archiveMasteredSkills,
    // onArchiveSkill,
    onPrioritizeSkill,
    onColorChangeSkill,
    duplicateSkill,

    setShowClassMode,
    setShowCalendar,
    setShowMap,
    setShowTraining,
    uid,
}) => {
    if (!selectedCharacter) return null;

    // Award XP and persist the claimed state in one atomic save
    const handleCompleteSkill = (skillId: string, xpAmount: number) => {
        const curXp: number = selectedCharacter.xp ?? 0;
        const curLevel: number = selectedCharacter.level ?? 1;
        let newXP = curXp + xpAmount;
        let newLevel = curLevel;
        while (newXP >= xpThreshold(newLevel)) { newXP -= xpThreshold(newLevel); newLevel++; }
        // Keep currencyXp (spendable total) in sync — XPPanel displays it when present
        const existingCurrency = typeof (selectedCharacter as any).currencyXp === 'number'
            ? Math.max(0, Math.floor((selectedCharacter as any).currencyXp))
            : 0;
        const newCurrency = existingCurrency + xpAmount;
        const skillAtComplete = (selectedCharacter.skills ?? []).find((s: Skill) => s.id === skillId);
        const updatedSkills = (selectedCharacter.skills ?? []).map((s: Skill) =>
            s.id === skillId ? { ...s, xpClaimedAt: Date.now(), xpClaimedLevel: sumLevels(skillAtComplete ?? s) } : s
        );
        const updated = { ...selectedCharacter, xp: newXP, level: newLevel, currencyXp: newCurrency, skills: updatedSkills };
        setUserCharacters((prev: any) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    // Awards XP for a subskill completion — does not touch skill-level xpClaimedAt
    const handleAwardXp = (xpAmount: number) => {
        // Use functional updater so we always operate on the LATEST state, not the
        // stale `selectedCharacter` that may not yet include the xpClaimedAt written
        // by onUpdate in the same tick.
        setUserCharacters((prev: any) => {
            const latest = prev[selectedCharacter.id] ?? selectedCharacter;
            const curXp: number = latest.xp ?? 0;
            const curLevel: number = latest.level ?? 1;
            let newXP = curXp + xpAmount;
            let newLevel = curLevel;
            while (newXP >= xpThreshold(newLevel)) { newXP -= xpThreshold(newLevel); newLevel++; }
            const existingCurrency = typeof latest.currencyXp === 'number'
                ? Math.max(0, Math.floor(latest.currencyXp))
                : 0;
            const newCurrency = existingCurrency + xpAmount;
            const updated = { ...latest, xp: newXP, level: newLevel, currencyXp: newCurrency };
            saveCharacter(updated).catch(console.error);
            return { ...prev, [updated.id]: updated };
        });
    };

    const [skillSearch, setSkillSearch] = useState('');
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [newSkillTypeLocal, setNewSkillTypeLocal] = useState<string>('data');
    const [newSkillAmountTarget, setNewSkillAmountTarget] = useState<number | undefined>(undefined);
    const [searchResults, setSearchResults] = useState<Skill[]>([]);
    const [subskillToast, setSubskillToast] = useState<{ msg: string; skillId: string; top: number; left: number } | null>(null);
    const subskillToastRef = useRef<number | null>(null);
    const focusTimeout = useRef<number | null>(null);
    const focusDebounce = useRef<number | null>(null);

    useEffect(() => {
        if (focusDebounce.current) {
            window.clearTimeout(focusDebounce.current);
            focusDebounce.current = null;
        }
        if (!skillSearch) return;
        const q = skillSearch.trim().toLowerCase();
        if (!q) return;

        // debounce user typing - wait 400ms after last keystroke
        focusDebounce.current = window.setTimeout(() => {
            const skills = selectedCharacter.skills ?? [];
            const matches: Skill[] = [];
            // recursively check if any subskill/nested skill name matches
            const subskillMatches = (nodes: any[]): boolean => {
                for (const n of nodes) {
                    if ((n.name || '').toString().toLowerCase().includes(q)) return true;
                    if (Array.isArray(n.subskills) && subskillMatches(n.subskills)) return true;
                }
                return false;
            };
            for (const s of skills) {
                const name = (s.name || '').toString().toLowerCase();
                const dateLabel = (s as any).createdAt
                    ? new Date((s as any).createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }).toLowerCase()
                    : '';
                if (name.includes(q) || dateLabel.includes(q) || subskillMatches(s.subskills ?? [])) matches.push(s);
            }
            // limit to first 8 matches
            setSearchResults(matches.slice(0, 8));
        }, 400) as unknown as number;

        return () => {
            if (focusDebounce.current) window.clearTimeout(focusDebounce.current);
        };
    }, [skillSearch, selectedCharacter]);

    // cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (focusDebounce.current) window.clearTimeout(focusDebounce.current);
            if (focusTimeout.current) window.clearTimeout(focusTimeout.current);
            if (subskillToastRef.current) window.clearTimeout(subskillToastRef.current);
        };
    }, []);

    const handleAddSubskill = (skillId: string, name: string) => {
        try { addSubskill(skillId, name); } catch (e) { /* still show toast */ }

        // compute position of the skill element so the toast can overlay it
        const el = document.getElementById(`skill_${skillId}`);
        let top = 80; // fallback
        let left = window.innerWidth / 2 - 100;
        if (el) {
            const r = el.getBoundingClientRect();
            top = Math.max(8, r.top + window.scrollY - 40);
            left = Math.min(window.innerWidth - 160, Math.max(8, r.left + window.scrollX + (r.width / 2) - 80));
        }

        setSubskillToast({ msg: 'Subskill added', skillId, top, left });
        if (subskillToastRef.current) window.clearTimeout(subskillToastRef.current);
        subskillToastRef.current = window.setTimeout(() => {
            setSubskillToast(null);
            subskillToastRef.current = null;
        }, 1800) as unknown as number;
    };

    const selectSkill = (skillId: string) => {
        const id = `skill_${skillId}`;
        // scroll into view and focus after a tick
        window.setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
                try { (el as HTMLElement).focus(); } catch (e) { /* ignore */ }
                // add temporary highlight
                el.classList.add('ring-2');
                el.classList.add('ring-indigo-400');
                if (focusTimeout.current) window.clearTimeout(focusTimeout.current);
                focusTimeout.current = window.setTimeout(() => {
                    el.classList.remove('ring-2');
                    el.classList.remove('ring-indigo-400');
                    focusTimeout.current = null;
                }, 2500) as unknown as number;
            }
        }, 80);
        // hide results after click
        setSearchResults([]);
        setSkillSearch('');
    };

    const [mobileEditorSkillId, setMobileEditorSkillId] = useState<string | null>(null);

    return (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-cyan-700">Skills</h2>
                    <button
                        onClick={() => { if (!showSkills) setShowSkills(true); setNewSkillTypeLocal('data'); setNewSkillAmountTarget(undefined); setShowAddSkillForm(true); }}
                        aria-label="Add skill"
                        disabled={controlsDisabled}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-blue-500 hover:bg-blue-600 text-white text-lg font-bold leading-none disabled:opacity-40"
                    >
                        +
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSkills(prev => !prev)}
                        aria-label={showSkills ? 'Hide skills' : 'Show skills'}
                        className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
                    >
                        <ToggleArrow open={showSkills} size={18} />
                    </button>
                </div>
            </div>

            {showSkills && (
                <>
                    <div className="flex flex-col gap-4">
                        {showAddSkillForm ? (
                            <div className="mb-4 p-3 border rounded bg-gray-50">
                                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                                    <input
                                        value={newSkillName}
                                        onChange={(e) => setNewSkillName(e.target.value)}
                                        placeholder="Skill name"
                                        className="flex-1 border rounded px-2 py-1 w-full"
                                        disabled={controlsDisabled}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => addSkill(undefined, { type: newSkillTypeLocal, amountTarget: newSkillAmountTarget })} className="px-3 py-1 bg-blue-500 text-white rounded" disabled={controlsDisabled}>Add</button>
                                    <button onClick={() => { setShowAddSkillForm(false); setNewSkillName(""); }} className="px-3 py-1 bg-gray-200 rounded" disabled={controlsDisabled}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4 w-full">
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => isAdmin(uid) ? setShowClassMode(true) : alert('not available for this account')} className="w-full px-3 py-1 bg-cyan-500 text-white rounded">Class Mode</button>
                                    {setShowCalendar && (
                                        <button onClick={() => setShowCalendar(true)} className="w-full px-3 py-1 bg-purple-500 text-white rounded">Calendar</button>
                                    )}
                                    <button onClick={() => { if (setShowMap) setShowMap(true); }} className="w-full px-3 py-1 bg-indigo-500 text-white rounded">Organization</button>
                                    {setShowTraining && (
                                        <button onClick={() => setShowTraining(true)} className="w-full px-3 py-1 bg-amber-400 text-black rounded font-semibold">Training</button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="mb-2">
                            <input value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Find skill" className="w-full border rounded px-2 py-1" />
                        </div>

                        {/* subskill toast is rendered as a floating overlay below */}

                        {searchResults.length > 0 && (
                            <div className="mb-2 bg-white border rounded shadow-sm p-2">
                                <div className="text-sm text-gray-600 mb-1">{searchResults.length} match{searchResults.length !== 1 ? 'es' : ''} found</div>
                                <div className="flex flex-col gap-1">
                                    {searchResults.map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => selectSkill(s.id)}
                                            className="text-left text-sm p-2 hover:bg-gray-50 rounded w-full"
                                        >
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(selectedCharacter.skills ?? []).map((skill: Skill) => (
                            <SkillItem
                                key={skill.id}
                                elementId={`skill_${skill.id}`}
                                name={skill.name}
                                notes={skill.notes}
                                color={skill.color}
                                progress={skill.progress}
                                amountTarget={skill.amountTarget}
                                amountValue={skill.amountValue}
                                createdAt={skill.createdAt}
                                subskills={skill.subskills ?? []}
                                type={skill.type}
                                levelCount={skill.levelCount}
                                onProgressUpdate={(p, extra) => updateSkill(skill.id, p, p >= 100, undefined, undefined, undefined, undefined, extra)}
                                onMaster={() => updateSkill(skill.id, 100, true)}
                                onDelete={() => deleteSkill(skill.id)}
                                // onArchive={() => onArchiveSkill && onArchiveSkill(skill.id)}
                                onPrioritize={() => onPrioritizeSkill && onPrioritizeSkill(skill.id)}
                                onRename={(newName) => updateSkill(skill.id, undefined, false, newName)}

                                onAddSubskill={(name) => handleAddSubskill(skill.id, name)}
                                onUpdateSubskill={(subId, updates) => updateSubskill(skill.id, subId, updates)}
                                onDeleteSubskill={(subId) => deleteSubskill(skill.id, subId)}
                                onColorChange={(c) => onColorChangeSkill && onColorChangeSkill(skill.id, c)}
                                onSaveNote={(note: string) => updateSkill(skill.id, undefined, false, undefined, note)}
                                onDuplicate={() => duplicateSkill && duplicateSkill(skill.id)}

                                onLevelUp={() => {
                                    if (!isAdmin(uid) && (skill.levelCount ?? 1) >= 10) {
                                        alert('Level limit reached. Skills can only go up to level 10.');
                                        return;
                                    }
                                    updateSkill(skill.id, 0, false, undefined, undefined, undefined, ((skill.levelCount ?? 1) + 1), { xpClaimedAt: undefined, xpClaimedLevel: undefined });
                                }}
                                onOpenMobile={() => setMobileEditorSkillId(skill.id)}

                                uid={uid}
                                xpClaimedAt={(() => { const s = skill as any; return s.xpClaimedAt && s.xpClaimedLevel === sumLevels(s) ? s.xpClaimedAt : undefined; })()}
                                characterXp={selectedCharacter.xp ?? 0}
                                characterLevel={selectedCharacter.level ?? 1}
                                onCompleteSkill={(xp) => handleCompleteSkill(skill.id, xp)}
                                onAwardXp={handleAwardXp}

                                disabled={controlsDisabled}
                            />
                        ))}
                        {mobileEditorSkillId && (
                            <SkillEditorMobile
                                skills={selectedCharacter.skills}
                                selectedSkillId={mobileEditorSkillId}
                                selectedCharacter={selectedCharacter}
                                setUserCharacters={setUserCharacters}
                                saveCharacter={saveCharacter}
                                controlsDisabled={controlsDisabled}
                                onClose={() => setMobileEditorSkillId(null)}
                                addSkill={addSkill}
                                updateSkill={(skillId: string, p: number, extra?: any) => updateSkill(skillId, p, p >= 100, undefined, undefined, undefined, undefined, extra)}
                                addSubskill={(skillId: string, name: string) => addSubskill(skillId, name)}
                                updateSubskill={(skillId: string, subId: string, updates: any) => updateSubskill(skillId, subId, updates)}
                                deleteSubskill={(skillId: string, subId: string) => deleteSubskill(skillId, subId)}
                                onLevelUp={(skillId: string) => updateSkill(skillId, 0, false, undefined, undefined, undefined, (((selectedCharacter.skills ?? []).find((s: any) => s.id === skillId)?.levelCount ?? 1) + 1))}
                                onRename={(skillId: string, newName: string) => updateSkill(skillId, undefined, false, newName)}
                            />
                        )}
                    </div>
                </>
            )}

            {subskillToast && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="pointer-events-auto bg-indigo-600 text-white px-4 py-2 rounded shadow-lg">
                        {subskillToast.msg}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillsPanel;
