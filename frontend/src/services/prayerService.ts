import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Prayer } from "../types/character";
import type { PrayOrbGroup } from "../components/focus/focusOrbUtils";

// Firestore path helper — keeps everything consistent
function prayerRef(userId: string) {
    return doc(db, "users", userId, "data", "prayers");
}

// --- Fetch all prayers ---
export async function getPrayers(userId: string): Promise<Prayer[]> {
    const ref = prayerRef(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        // Initialize empty doc
        await setDoc(ref, { prayers: [] });
        return [];
    }

    return (snap.data().prayers as Prayer[]) ?? [];
}

// --- Add a new prayer ---
export async function addPrayer(userId: string, text: string, color: string) {
    const ref = prayerRef(userId);
    const snap = await getDoc(ref);

    const prayers: Prayer[] = snap.exists()
        ? (snap.data().prayers as Prayer[]) ?? []
        : [];

    const newPrayer: Prayer = {
        id: uuidv4(),
        text,
        color,
    };

    await setDoc(ref, { prayers: [...prayers, newPrayer] }, { merge: true });
}

// --- Update a prayer by ID ---
export async function updatePrayer(
    userId: string,
    prayerId: string,
    update: Partial<Prayer>
) {
    const ref = prayerRef(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const prayers: Prayer[] = snap.data().prayers ?? [];

    const updated = prayers.map((p) =>
        p.id === prayerId ? { ...p, ...update } : p
    );

    await setDoc(ref, { prayers: updated }, { merge: true });
}

// ─── Prayer Requests (per-character ongoing requests with XP/level) ──────────

export interface PrayerRequest {
    id: string;
    text: string;
    startDate: number; // epoch ms
    progress: number;  // 0–100
    level: number;     // starts at 1
}

function prayerRequestsRef(userId: string, characterId: string) {
    return doc(db, "users", userId, "prayerRequests", characterId);
}

export async function loadPrayerRequests(
    userId: string,
    characterId: string
): Promise<PrayerRequest[]> {
    const snap = await getDoc(prayerRequestsRef(userId, characterId));
    if (!snap.exists()) return [];
    return (snap.data().requests as PrayerRequest[]) ?? [];
}

export async function savePrayerRequests(
    userId: string,
    characterId: string,
    requests: PrayerRequest[]
): Promise<void> {
    await setDoc(prayerRequestsRef(userId, characterId), { requests }, { merge: true });
}

// ─── Prayer Orb Groups (collapsed clusters of prayer/drawing orbs) ──────────

function prayerOrbGroupsRef(userId: string, characterId: string) {
    return doc(db, "users", userId, "prayerOrbGroups", characterId);
}

export async function loadPrayerOrbGroups(
    userId: string,
    characterId: string
): Promise<PrayOrbGroup[]> {
    const snap = await getDoc(prayerOrbGroupsRef(userId, characterId));
    if (!snap.exists()) return [];
    return (snap.data().groups as PrayOrbGroup[]) ?? [];
}

export async function savePrayerOrbGroups(
    userId: string,
    characterId: string,
    groups: PrayOrbGroup[]
): Promise<void> {
    await setDoc(prayerOrbGroupsRef(userId, characterId), { groups }, { merge: true });
}