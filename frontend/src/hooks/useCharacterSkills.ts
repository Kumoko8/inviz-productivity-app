import { useState } from "react";
// import { appendArchivedSkill, appendArchivedSkills } from "../services/characterService";
import { isAdmin } from '../utils/adminConfig';
import { Skill } from "../types/character";
import { makeNewSkill, makeNewSubskill } from "../utils/characterUtils";

type SaveCharacterFn = (c: any) => Promise<void>;

// Recursively derives a node's progress as the average of its children's progress.
// Leaf nodes (no subskills) return their own progress value directly.
function computeProgress(node: any): number {
    if (!Array.isArray(node.subskills) || node.subskills.length === 0)
        return typeof node.progress === 'number' ? node.progress : 0;
    const vals = node.subskills.map((c: any) => computeProgress(c));
    const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    return Math.round(avg);
}

// Runs the 2- or 3-stage level-up animation for a skill that hit 100%:
//   2-stage (direct skill update): immediately show 100 → after resetDelay reset to 0 + levelCount++
//   3-stage (subskill-driven): show children at prevParentProgress → after showFullDelay show parent at 100
//                               → after resetDelay reset parent + subskills to 0 and levelCount++
function triggerLevelSkillAnimation(
    skillId: string,
    character: any,
    setCharacters: (updater: (prev: Record<string, any>) => Record<string, any>) => void,
    saveCharacter: SaveCharacterFn,
    opts: {
        subskillsAtFill?: any[];
        prevParentProgress?: number;
        showFullDelay?: number;
        resetDelay?: number;
    } = {}
) {
    const { subskillsAtFill, prevParentProgress, showFullDelay = 0, resetDelay = 800 } = opts;

    const buildFull = (base: any): any => ({
        ...base,
        skills: (base.skills ?? []).map((ss: any) =>
            ss.id !== skillId ? ss : {
                ...ss,
                ...(subskillsAtFill ? { subskills: subskillsAtFill } : {}),
                progress: 100,
                mastered: false,
            }
        ),
    });

    const buildReset = (base: any): any => ({
        ...base,
        skills: (base.skills ?? []).map((ss: any) =>
            ss.id !== skillId ? ss : {
                ...ss,
                ...(subskillsAtFill ? { subskills: subskillsAtFill.map((x: any) => ({ ...x, progress: 0, mastered: false })) } : {}),
                progress: 0,
                levelCount: (ss.levelCount ?? 1) + 1,
                mastered: false,
            }
        ),
    });

    const apply = (state: any): any => {
        setCharacters(prev => ({ ...prev, [state.id]: state }));
        saveCharacter(state).catch(console.error);
        return state;
    };

    if (subskillsAtFill && prevParentProgress !== undefined && showFullDelay > 0) {
        // 3-stage: children fill → parent fills → reset
        const stage1: any = {
            ...character,
            skills: (character.skills ?? []).map((ss: any) =>
                ss.id !== skillId ? ss : { ...ss, subskills: subskillsAtFill, progress: prevParentProgress, mastered: false }
            ),
        };
        apply(stage1);
        setTimeout(() => {
            const stage2 = apply(buildFull(stage1));
            setTimeout(() => apply(buildReset(stage2)), resetDelay);
        }, showFullDelay);
    } else {
        // 2-stage: show at 100 → reset
        const full = apply(buildFull(character));
        setTimeout(() => apply(buildReset(full)), resetDelay);
    }
}

export default function useCharacterSkills({
    userId,
    selectedCharacter,
    setUserCharacters,
    saveCharacter,
    controlsDisabled,
    // onArchiveComplete,
    // onSingleArchiveComplete,
}: {
    userId?: string;
    selectedCharacter: any;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: SaveCharacterFn;
    controlsDisabled: boolean;
    // onArchiveComplete?: (archived: any[]) => void;
    // onSingleArchiveComplete?: (item: any) => void;
}) {
    const uid = userId;
    const [showAddSkillForm, setShowAddSkillForm] = useState(false);
    const [newSkillName, setNewSkillName] = useState("");
    // difficulty removed; new skills default to data type

    const addSkill = (nameArg?: string, opts?: { type?: string; amountTarget?: number }) => {
        if (!selectedCharacter) {
            alert("Please select a character first");
            return;
        }
        if (!isAdmin(uid) && (selectedCharacter.skills ?? []).length >= 10) {
            alert('Skill limit reached. You can have up to 10 skills at one time.');
            return;
        }
        const name = (nameArg !== undefined ? nameArg : newSkillName).trim();
        if (!name) return;
        const skillType = opts?.type || 'data';
        const newSkill: Skill = makeNewSkill(name, skillType, opts?.amountTarget);
        const updated = {
            ...selectedCharacter,
            skills: [newSkill, ...(selectedCharacter.skills ?? [])],
        };
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);

        // reset form
        setNewSkillName("");
        setShowAddSkillForm(false);
    };

    const addSubskill = (skillId: string, subName: string) => {
        if (!selectedCharacter) return;
        const name = subName.trim();
        if (!name) return;
        if (!isAdmin(uid)) {
            const parentSkill = (selectedCharacter.skills ?? []).find((s: any) => s.id === skillId);
            if (parentSkill && (parentSkill.subskills ?? []).length >= 5) {
                alert('Subskill limit reached. Each skill can have up to 5 subskills.');
                return;
            }
        }
        const newSub = makeNewSubskill(name);
        // Insert new subskill and recompute parent progress as average of (possibly nested) children
        const updated = { ...selectedCharacter } as any;
        updated.skills = (selectedCharacter.skills ?? []).map((s: Skill) => {
            if (s.id !== skillId) return s;
            const subs = s.subskills ?? [];
            const nextSubs = s.type === 'list' ? ([...subs, newSub]) : ([newSub, ...subs]);
            const next = { ...s, subskills: nextSubs } as any;
            // compute derived progress from children
            const derived = computeProgress(next);
            next.progress = derived;
            next.mastered = derived >= 100 ? true : false;
            return next;
        });
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const updateSubskill = (skillId: string, subskillId: string, updates: Partial<any>) => {
        if (!selectedCharacter) return;

        // Subskills no longer auto-level themselves. Parent-level skills handle
        // level progression when all immediate subskills reach 100%.

        // Helper: recursively update a subskill by id and return [newSubskills, changed]
        const updateRecursive = (nodes: any[]): [any[], boolean] => {
            let changed = false;
            const next = nodes.map((node) => {
                if (node.id === subskillId) {
                    changed = true;
                    // apply updates to the matched node
                    return { ...node, ...updates, updatedAt: Date.now() };
                }
                if (Array.isArray(node.subskills) && node.subskills.length > 0) {
                    const [childNext, childChanged] = updateRecursive(node.subskills);
                    if (childChanged) {
                        changed = true;
                        return { ...node, subskills: childNext };
                    }
                }
                return node;
            });
            return [next, changed];
        };

        // compute derived progress for a node (average of children if any)

        const updated = { ...selectedCharacter } as any;
        updated.skills = (selectedCharacter.skills ?? []).map((s: Skill) => {
            if (s.id !== skillId) return s;
            const subs = s.subskills ?? [];
            const [newSubs, wasChanged] = updateRecursive(subs);
            if (!wasChanged) return s;

            // After applying the update to subskills, recompute derived progress for nested nodes
            const progressChanged = 'progress' in updates;
            const applyDerived = (nodes: any[]): any[] => {
                return nodes.map((n: any) => {
                    const nextChildren = Array.isArray(n.subskills) && n.subskills.length > 0 ? applyDerived(n.subskills) : n.subskills;
                    const base = { ...n, subskills: nextChildren };
                    // Only recompute derived progress for intermediate nodes when progress changed
                    if (progressChanged && Array.isArray(nextChildren) && nextChildren.length > 0) {
                        const derived = computeProgress(base);
                        base.progress = derived;
                        base.mastered = derived >= 100;
                    }
                    return base;
                });
            };

            const derivedSubs = applyDerived(newSubs);

            // Only recompute the top-level average when progress actually changed.
            // For name-only (or other non-progress) updates, preserve existing values.
            const topAvg = progressChanged
                ? (derivedSubs.length > 0 ? Math.round(derivedSubs.reduce((a: number, b: any) => a + (typeof b.progress === 'number' ? b.progress : 0), 0) / derivedSubs.length) : (s.progress ?? 0))
                : (s.progress ?? 0);

            // If the parent skill was switched into level mode and all immediate subskills
            // have reached 100% (topAvg >= 100), trigger the parent-level animation:
            // 1) save state with parent showing 100% so UI can animate
            // 2) after a short delay reset parent progress to 0, increment levelCount,
            //    and reset all immediate subskills to 0 to start the next level.
            const prevTop = s.progress ?? 0;
            if (s.type === 'level' && prevTop < 100 && topAvg >= 100) {
                triggerLevelSkillAnimation(skillId, selectedCharacter, setUserCharacters, saveCharacter, {
                    subskillsAtFill: derivedSubs,
                    prevParentProgress: prevTop,
                    showFullDelay: 120,
                    resetDelay: 800,
                });
                return { ...s };
            }

            const nextSkill = { ...s, subskills: derivedSubs, progress: topAvg, mastered: topAvg >= 100 } as any;
            return nextSkill;
        });

        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const deleteSubskill = (skillId: string, subskillId: string) => {
        if (!selectedCharacter) return;
        const updated = { ...selectedCharacter } as any;
        updated.skills = (selectedCharacter.skills ?? []).map((s: Skill) => {
            if (s.id !== skillId) return s;
            const nextSubs = (s.subskills ?? []).filter((ss: any) => ss.id !== subskillId);
            // recompute top-level from remaining children
            const derivedSubs = nextSubs.map((n: any) => {
                if (Array.isArray(n.subskills) && n.subskills.length > 0) {
                    const apply = (nodes: any[]): any[] => nodes.map((x: any) => {
                        if (Array.isArray(x.subskills) && x.subskills.length > 0) x.subskills = apply(x.subskills);
                        if (Array.isArray(x.subskills) && x.subskills.length > 0) x.progress = computeProgress(x);
                        return x;
                    });
                    n.subskills = apply(n.subskills);
                    n.progress = computeProgress(n);
                }
                return n;
            });
            const topAvg = derivedSubs.length > 0 ? Math.round(derivedSubs.reduce((a: number, b: any) => a + (typeof b.progress === 'number' ? b.progress : 0), 0) / derivedSubs.length) : 0;
            return { ...s, subskills: derivedSubs, progress: topAvg, mastered: topAvg >= 100 } as any;
        });
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const updateSkill = (
        skillId: string,
        progress?: number,
        mastered = false,
        name?: string,
        notes?: string,
        type?: string,
        levelCount?: number,
        extra?: any,
    ) => {
        if (!selectedCharacter) return;
        // If this is a level-type skill and we're moving from <100 to >=100, first save 100% so UI can animate, then reset to 0 and increment levelCount after a delay.
        const skillsArr = (selectedCharacter.skills ?? []) as any[];
        const targetSkill = skillsArr.find(s => s.id === skillId);
        const prevSkillProgress = targetSkill?.progress ?? 0;
        const requestedProgress = typeof progress === 'number' ? progress : prevSkillProgress;
        if (targetSkill?.type === 'level' && typeof requestedProgress === 'number' && requestedProgress >= 100 && prevSkillProgress < 100) {
            triggerLevelSkillAnimation(skillId, selectedCharacter, setUserCharacters, saveCharacter);
            return;
        }

        const updated = {
            ...selectedCharacter,
            skills: (selectedCharacter.skills ?? []).map((s: Skill) =>
                s.id === skillId
                    ? (() => {
                        let newProgress = typeof progress === "number" ? progress : s.progress;
                        const willBeMastered = mastered || newProgress >= 100;
                        return {
                            ...s,
                            ...(typeof progress === "number" ? { progress: newProgress } : {}),
                            mastered: willBeMastered,
                            ...(name !== undefined ? { name } : {}),
                            ...(notes !== undefined ? { notes } : {}),
                            // difficulty removed
                            ...(type !== undefined ? { type } : {}),
                            ...(levelCount !== undefined ? { levelCount } : {}),
                            ...(extra ? extra : {}),
                            ...(willBeMastered ? { completedAt: s.completedAt ?? Date.now() } : { completedAt: undefined }),
                        };
                    })()
                    : s
            ),
        } as any;
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const deleteSkill = (skillId: string) => {
        if (!selectedCharacter) return;
        const updated = {
            ...selectedCharacter,
            skills: (selectedCharacter.skills ?? []).filter((s: Skill) => s.id !== skillId),
        };
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };

    const duplicateSkill = (skillId: string) => {
        if (!selectedCharacter) return;
        const skills = (selectedCharacter.skills ?? []) as any[];
        const idx = skills.findIndex(s => s.id === skillId);
        if (idx === -1) return;
        const src = skills[idx];
        const now = Date.now();
        // deep clone and generate new ids for skill and subskills and tags
        const cloneSkill: any = JSON.parse(JSON.stringify(src));
        cloneSkill.id = `${now}_${Math.random().toString(36).slice(2, 8)}`;
        cloneSkill.name = `${cloneSkill.name} copy`;
        cloneSkill.progress = 0;
        cloneSkill.mastered = false;
        cloneSkill.completedAt = undefined;
        cloneSkill.createdAt = now;
        if (Array.isArray(cloneSkill.subskills)) {
            cloneSkill.subskills = cloneSkill.subskills.map((ss: any) => ({ ...ss, id: `${now}_${Math.random().toString(36).slice(2, 8)}`, progress: 0, mastered: false, createdAt: now }));
        }
        if (Array.isArray(cloneSkill.tags)) {
            cloneSkill.tags = cloneSkill.tags.map((t: any) => ({ ...t, id: `${now}_${Math.random().toString(36).slice(2, 8)}` }));
        }

        const nextSkills = skills.slice();
        nextSkills.splice(idx, 0, cloneSkill); // insert above current

        const updated = { ...selectedCharacter, skills: nextSkills } as any;
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        saveCharacter(updated).catch(console.error);
    };



    // const archiveMasteredSkills = async () => {
    //     if (!selectedCharacter) return;
    //     // consider a skill mastered only when the main skill is mastered (flag or progress>=100)
    //     // AND all of its subskills are also mastered (flag or progress>=100). This avoids
    //     // archiving a parent whose subskills are incomplete, or archiving a parent that
    //     // only has completed subskills but the parent itself is not completed.
    //     const isCompleted = (p: any) => (p && (p.mastered === true || (typeof p.progress === 'number' && p.progress >= 100)));
    //     const mastered = (selectedCharacter.skills ?? []).filter((s: Skill) => {
    //         if (!isCompleted(s)) return false;
    //         const subs = s.subskills ?? [];
    //         return subs.every((ss: any) => isCompleted(ss));
    //     });
    //     if (mastered.length === 0) return;

    //     const existingArchived = (selectedCharacter.archivedSkills ?? []).slice();
    //     const newItems: any[] = [];
    //     for (let i = 0; i < mastered.length; i++) {
    //         const m = mastered[i];
    //         // Use the skill's recorded completedAt when available. If missing, generate a per-item fallback
    //         const ts = m.completedAt ?? (Date.now() + i);
    //         const archivedItem = { id: Date.now().toString() + '_' + m.id, name: m.name, completedAt: ts, originalSkillId: m.id, subskills: m.subskills ?? [], createdAt: m.createdAt };
    //         newItems.push(archivedItem);
    //     }

    //     const combined = existingArchived.concat(newItems);
    //     // remove any skill that is considered completed (use same isCompleted predicate)
    //     const remainingSkills = (selectedCharacter.skills ?? []).filter((s: Skill) => !isCompleted(s));
    //     const updated = {
    //         ...selectedCharacter,
    //         skills: remainingSkills,
    //         archivedSkills: combined.sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    //     } as any;

    //     setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    //     try {
    //         // Append only the new archived items atomically to avoid overwriting previous archives
    //         if (uid) {
    //             await appendArchivedSkills(uid, updated.id, newItems, updated.skills);
    //         } else {
    //             // if we don't have a user id in this hook, fall back to saving the whole character
    //             await saveCharacter(updated);
    //         }
    //     } catch (err) {
    //         // fallback to full save
    //         saveCharacter(updated).catch(console.error);
    //     }
    //     // notify caller (Dashboard) that archive completed with only the newly archived items
    //     try {
    //         if (onArchiveComplete) onArchiveComplete(newItems);
    //     } catch (err) {
    //         console.warn('useCharacterSkills: onArchiveComplete threw', err);
    //     }
    // };

    // const archiveSkill = async (skillId: string) => {
    //     if (!selectedCharacter) return;
    //     const skill = (selectedCharacter.skills ?? []).find((s: any) => s.id === skillId);
    //     if (!skill) return;

    //     const archivedItem = {
    //         id: `archived-${Date.now()}-${skill.id}`,
    //         name: skill.name,
    //         difficulty: skill.difficulty,
    //         completedAt: Date.now(),
    //         originalSkillId: skill.id,
    //         subskills: skill.subskills ?? [],
    //         createdAt: skill.createdAt ?? Date.now(),
    //     } as any;

    //     const nextArchived = [archivedItem].concat(selectedCharacter.archivedSkills ?? []);
    //     const nextSkills = (selectedCharacter.skills ?? []).filter((s: any) => s.id !== skillId);
    //     const updated = { ...selectedCharacter, skills: nextSkills, archivedSkills: nextArchived } as any;
    //     setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    //     try {
    //         await appendArchivedSkill(uid as string, updated.id, archivedItem, nextSkills);
    //     } catch (err) {
    //         console.error('Error archiving skill', err);
    //         try {
    //             await saveCharacter(updated);
    //         } catch (err2) {
    //             console.error('Fallback saveCharacter failed', err2);
    //         }
    //     }
    //     if (onSingleArchiveComplete) onSingleArchiveComplete(archivedItem);
    // };

    const setSkillColor = async (skillId: string, color: string) => {
        if (!selectedCharacter) return;
        const updated = {
            ...selectedCharacter,
            skills: (selectedCharacter.skills ?? []).map((s: any) => s.id === skillId ? { ...s, color } : s),
        } as any;
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        try {
            await saveCharacter(updated);
        } catch (err) {
            console.error('Error setting skill color', err);
        }
    };

    const prioritizeSkill = async (skillId: string) => {
        if (!selectedCharacter) return;
        const skills = (selectedCharacter.skills ?? []).slice();
        const idx = skills.findIndex((s: any) => s.id === skillId);
        if (idx === -1) return;
        const [item] = skills.splice(idx, 1);
        skills.unshift(item);
        const updated = { ...selectedCharacter, skills } as any;
        setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
        try {
            await saveCharacter(updated);
        } catch (err) {
            console.error('Error prioritizing skill', err);
        }
    };

    return {
        showAddSkillForm,
        setShowAddSkillForm,
        newSkillName,
        setNewSkillName,
        addSkill,
        updateSkill,
        deleteSkill,
        addSubskill,
        updateSubskill,
        deleteSubskill,
        // archiveMasteredSkills,
        duplicateSkill,
        // archiveSkill,
        setSkillColor,
        prioritizeSkill,
    };
}
