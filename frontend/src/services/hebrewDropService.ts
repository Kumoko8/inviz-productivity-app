/**
 * HebrewDrop Firestore service.
 *
 * Firestore layout
 * ────────────────
 *   users/{uid}/hebrewDrop/data — { vocabWords: HebrewVocabEntry[], goalGroups: GoalGroupStored[] }
 *
 * A HebrewVocabEntry is the Hebrew equivalent of CustomKanjiEntry:
 *   - char          = the full Hebrew word (e.g. "מלך")
 *   - meaning       = English gloss
 *   - transliteration = romanisation (e.g. "melek")
 *   - recipe.a      = anchor letter ID (e.g. "mem")
 *   - recipe.b/c/d  = required adjacent letter IDs ('' = unused)
 *   - recipe.xp     = XP awarded on merge
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HebrewVocabEntry {
    id: string;
    char: string;            // full Hebrew word, e.g. "מלך"
    meaning: string;         // English gloss
    transliteration: string; // romanisation, e.g. "melek"
    recipe?: {
        /** Ordered letter IDs in Hebrew word order (RTL). Max 7. */
        letters: string[];
        xp: number;
    };
}

export interface GoalGroupStored {
    id: string;
    name: string;
    memberIds: string[];
    open: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userDocRef(uid: string) {
    return doc(db, 'users', uid, 'hebrewDrop', 'data');
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function loadHebrewVocab(uid: string): Promise<HebrewVocabEntry[]> {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return [];
    const data = snap.data() as { vocabWords?: HebrewVocabEntry[] };
    return data.vocabWords ?? [];
}

export async function saveHebrewVocab(uid: string, words: HebrewVocabEntry[]): Promise<void> {
    await setDoc(userDocRef(uid), { vocabWords: words }, { merge: true });
}

export async function loadHbGoalGroups(uid: string): Promise<GoalGroupStored[]> {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return [];
    const data = snap.data() as { goalGroups?: GoalGroupStored[] };
    return data.goalGroups ?? [];
}

export async function saveHbGoalGroups(uid: string, groups: GoalGroupStored[]): Promise<void> {
    await setDoc(userDocRef(uid), { goalGroups: groups }, { merge: true });
}
