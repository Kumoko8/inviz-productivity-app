import { useState, useEffect } from 'react';
import { getCharacters, getUserCharacters, writeUserCharacter } from '../services/characterService';
import { getUserDoc } from '../services/userService';
import { characterData } from '../components/CharacterData';
import type { Character } from '../types/character';

export default function useCharacterLoader(uid: string | null) {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [userCharacters, setUserCharacters] = useState<Record<string, any>>({});
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (!uid) return;

        const loadAll = async () => {
            try {
                const baseCharactersRaw = await getCharacters();
                const baseCharacters: Character[] = baseCharactersRaw.map((d: any) => ({ ...(d as any) }));
                setCharacters(baseCharacters);

                const userCharMap: Record<string, any> = await getUserCharacters(uid);

                // merge base + user data (ensuring skills/prayers are arrays)
                const merged: Record<string, any> = {};
                for (const base of baseCharacters) {
                    const u = userCharMap[base.id] ?? {};
                    merged[base.id] = {
                        ...base,
                        animation: typeof u.animation === 'string' ? u.animation : base.animation,
                        transformIndex: typeof u.transformIndex === 'number' ? u.transformIndex : (base.transformIndex ?? 0),
                        hp: typeof u.hp === 'number' ? u.hp : u.hp ?? 100,
                        maxHp: typeof u.maxHp === 'number' ? u.maxHp : u.maxHp ?? 100,
                        xp: typeof u.xp === 'number' ? u.xp : u.xp ?? 0,
                        level: typeof u.level === 'number' ? u.level : u.level ?? 1,
                        skills: Array.isArray(u.skills) ? u.skills : [],
                        // archivedSkills: Array.isArray((u as any).archivedSkills) ? (u as any).archivedSkills : [],
                        prayerPoints: typeof u.prayerPoints === 'number' ? u.prayerPoints : 0,
                        prayerLevel:  typeof u.prayerLevel  === 'number' ? u.prayerLevel  : 1,
                        createdAt: u.createdAt ?? Date.now(),
                        // per-user overrides that must survive the base-character merge
                        playerName: typeof (u as any).playerName === 'string' ? (u as any).playerName : undefined,
                        characterGroup: typeof (u as any).characterGroup === 'string' ? (u as any).characterGroup : undefined,
                        // Animation arrays live only in the base character doc — ensure they always survive the merge
                        actionAnimations: Array.isArray((u as any).actionAnimations) ? (u as any).actionAnimations : (Array.isArray((base as any).actionAnimations) ? (base as any).actionAnimations : undefined),
                        damageAnimations: Array.isArray((u as any).damageAnimations) ? (u as any).damageAnimations : (Array.isArray((base as any).damageAnimations) ? (base as any).damageAnimations : undefined),
                        defeatAnimations: Array.isArray((u as any).defeatAnimations) ? (u as any).defeatAnimations : (Array.isArray((base as any).defeatAnimations) ? (base as any).defeatAnimations : undefined),
                        woundedAnimations: Array.isArray((u as any).woundedAnimations) ? (u as any).woundedAnimations : (Array.isArray((base as any).woundedAnimations) ? (base as any).woundedAnimations : undefined),
                        // final name selection prefers per-user `name`, then base `name`, then a lookup
                        // into `characterData` (by animation/defaultAnimation), finally falling back to id.
                        name:
                            // prefer per-user `playerName` (student/owner name), then per-user `name`, then base display name
                            typeof (u as any).playerName === 'string' && (u as any).playerName
                                ? (u as any).playerName
                                : typeof u.name === 'string'
                                    ? u.name
                                    : (base as any).name
                                    ?? (characterData.find((cd) => cd.animation === (base as any).animation || cd.defaultAnimation === (base as any).animation)?.name)
                                    ?? (characterData.find((cd) => cd.animation === (base as any).defaultAnimation || cd.defaultAnimation === (base as any).defaultAnimation)?.name)
                                    ?? (base as any)._migratedFrom
                                    ?? base.id,
                    };
                }

                // Include any per-user-only characters (not present in base `characters`)
                for (const [id, udoc] of Object.entries(userCharMap)) {
                    if (!merged[id]) {
                        merged[id] = {
                            id,
                            name: (udoc as any).name ?? (udoc as any)._migratedFrom ?? 'Custom',
                            ...(udoc as any),
                            skills: Array.isArray((udoc as any).skills) ? (udoc as any).skills : [],
                            // archivedSkills: Array.isArray((udoc as any).archivedSkills) ? (udoc as any).archivedSkills : [],
                        };
                    }
                }

                setUserCharacters(merged);

                // Lazy-create missing per-user character docs so UI and persistence stay in sync.
                const legacyRoot = await getUserDoc(uid);
                const legacy = legacyRoot ?? {};

                for (const base of baseCharacters) {
                    if (!userCharMap[base.id]) {
                        const nameKey = base.name || (base as any)._migratedFrom || base.id;

                        const legacySkills = (legacy.characterSkills && legacy.characterSkills[nameKey]) || [];
                        const legacyXpObj = (legacy.characterXp && legacy.characterXp[nameKey]) || null;
                        const legacyHp = legacy.characterHp && typeof legacy.characterHp[nameKey] === 'number' ? legacy.characterHp[nameKey] : undefined;

                        const payload = {
                            hp: typeof legacyHp === 'number' ? legacyHp : 100,
                            maxHp: 100,
                            xp: legacyXpObj && typeof legacyXpObj.xp === 'number' ? legacyXpObj.xp : (typeof legacy.xp === 'number' ? legacy.xp : 0),
                            level: legacyXpObj && typeof legacyXpObj.level === 'number' ? legacyXpObj.level : (typeof legacy.level === 'number' ? legacy.level : 1),
                            skills: Array.isArray(legacySkills) ? legacySkills : [],
                            createdAt: Date.now(),
                        };

                        await writeUserCharacter(uid, base.id, payload);

                        merged[base.id] = {
                            ...base,
                            ...payload,
                        };
                    }
                }

                setUserCharacters(merged);
                setLoaded(true);
            } catch (err) {
                console.error('useCharacterLoader: loadAll failed', err);
            }
        };

        loadAll();
    }, [uid]);

    return { characters, userCharacters, setUserCharacters, loaded };
}
