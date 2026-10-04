import type { Skill } from '../types/character';

export function makeNewSkill(name: string, type: string = 'data', amountTarget?: number): Skill {
    const base: Skill = {
        id: Date.now().toString(),
        name,
        progress: 0,
        mastered: false,
        type,
        subskills: [],
        createdAt: Date.now(),
    };
    if (amountTarget !== undefined) base.amountTarget = amountTarget;
    return base;
}

export function makeNewSubskill(name: string) {
    return {
        id: Date.now().toString(),
        name,
        progress: 0,
        mastered: false,
    };
}

export function sanitizeForFirestore(v: any): any {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (Array.isArray(v)) return v.map(sanitizeForFirestore).filter((x) => x !== undefined);
    if (typeof v === 'object') {
        const out: any = {};
        for (const [k, val] of Object.entries(v)) {
            const cleaned = sanitizeForFirestore(val);
            if (cleaned !== undefined) out[k] = cleaned;
        }
        return out;
    }
    return v;
}
