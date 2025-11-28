import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Prayer } from "../types/character";

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