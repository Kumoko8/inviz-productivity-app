/**
 * KanjiDrop Firestore service.
 *
 * Firestore layout
 * ────────────────
 *   kanjiDrop/gameData            — { tiles, merges, targetPool }
 *   users/{uid}/kanjiDrop         — { customKanjis: StoredTile[] }
 *
 * Tiles are stored as { char, meaning, tier } — colours are computed
 * client-side by makeTile() so we don't redundantly persist hex strings.
 *
 * Merges are stored as objects { a, b, c, d, result, xp } because
 * Firestore arrays cannot contain nested arrays.
 */

import { db } from '../firebase';
import {
    doc,
    getDoc,
    setDoc,
} from 'firebase/firestore';
import { makeTile } from '../components/puzzle/KanjiDropData';
import type { TileDefExt } from '../components/puzzle/KanjiDropData';

// ─── Shape of data as stored in Firestore ────────────────────────────────────

export interface StoredTile {
    id: string;
    char: string;
    meaning: string;
    tier: number;
}

export interface StoredMerge {
    a: string;
    b: string;
    c: string;
    d: string;
    result: string;
    xp: number;
}

export interface GameData {
    tiles: Record<string, StoredTile>;
    merges: StoredMerge[];
    targetPool: string[];
}

// ─── Module-level cache (one fetch per app load) ──────────────────────────────

let cachedGameData: GameData | null = null;

// ─── Static game data ─────────────────────────────────────────────────────────

export async function loadGameData(): Promise<GameData> {
    if (cachedGameData) return cachedGameData;
    const snap = await getDoc(doc(db, 'kanjiDrop', 'gameData'));
    if (!snap.exists()) throw new Error('kanjiDrop/gameData document not found. Run the seed script first.');
    cachedGameData = snap.data() as GameData;
    return cachedGameData;
}

/**
 * Reconstruct a full TileDefExt map from stored minimal tile data.
 * Call this once after loadGameData() resolves.
 */
export function hydrateGamTiles(storedTiles: Record<string, StoredTile>): Record<string, TileDefExt> {
    const result: Record<string, TileDefExt> = {};
    for (const [id, t] of Object.entries(storedTiles)) {
        result[id] = makeTile(id, t.char, t.meaning, t.tier);
    }
    return result;
}

// ─── User custom kanjis ───────────────────────────────────────────────────────

/**
 * A custom kanji added by the user, with an optional merge recipe so it can
 * actually be built on the board without touching the source code.
 *
 * recipe.a  — the "anchor" tile the user places
 * recipe.b/c/d — the required neighbor tile IDs (empty string = unused slot)
 * The result of the merge is always this entry's id.
 */
export interface CustomKanjiEntry {
    id: string;
    char: string;
    meaning: string;
    tier: number;
    recipe?: { a: string; b: string; c: string; d: string; xp: number };
}

function userDocRef(uid: string) {
    return doc(db, 'users', uid, 'kanjiDrop', 'data');
}

export async function loadCustomKanjis(uid: string): Promise<CustomKanjiEntry[]> {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return [];
    const data = snap.data() as { customKanjis?: CustomKanjiEntry[] };
    return data.customKanjis ?? [];
}

export async function saveCustomKanjis(uid: string, kanjis: CustomKanjiEntry[]): Promise<void> {
    await setDoc(userDocRef(uid), { customKanjis: kanjis }, { merge: true });
}

// ─── Goal groups ──────────────────────────────────────────────────────────────

export interface GoalGroupStored {
    id: string;
    name: string;
    memberIds: string[];
    open: boolean;
}

export async function loadGoalGroups(uid: string): Promise<GoalGroupStored[]> {
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return [];
    const data = snap.data() as { goalGroups?: GoalGroupStored[] };
    return data.goalGroups ?? [];
}

export async function saveGoalGroups(uid: string, groups: GoalGroupStored[]): Promise<void> {
    await setDoc(userDocRef(uid), { goalGroups: groups }, { merge: true });
}
