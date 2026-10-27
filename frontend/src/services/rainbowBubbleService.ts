/**
 * RainbowBubble persistence.
 *
 * Firestore layout
 * ────────────────
 *   users/{uid}/rainbowBubble/data — { tiles: BubbleTile[], recipes: BubbleRecipe[], groups: BubbleGroup[] }
 *
 * Everything is user-created. localStorage mirrors the data so the game works offline / signed out.
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { BubbleData } from '../components/puzzle/rainbowbubble/rainbowBubbleTypes';

const LOCAL_KEY = 'rb-data';

function readLocal(): BubbleData {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Partial<BubbleData>;
            return { tiles: parsed.tiles ?? [], recipes: parsed.recipes ?? [], groups: parsed.groups ?? [] };
        }
    } catch { /* ignore corrupt cache */ }
    return { tiles: [], recipes: [], groups: [] };
}

function userDocRef(uid: string) {
    return doc(db, 'users', uid, 'rainbowBubble', 'data');
}

export async function loadBubbleData(uid: string | null): Promise<BubbleData> {
    if (!uid) return readLocal();
    const snap = await getDoc(userDocRef(uid));
    if (!snap.exists()) return readLocal();
    const data = snap.data() as Partial<BubbleData>;
    return { tiles: data.tiles ?? [], recipes: data.recipes ?? [], groups: data.groups ?? [] };
}

export async function saveBubbleData(uid: string | null, data: BubbleData): Promise<void> {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    if (uid) await setDoc(userDocRef(uid), data);
}
