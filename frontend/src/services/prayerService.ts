import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { Prayer } from "../types/character"



// Fetch prayers (global)
export async function getPrayers(userId: string): Promise<Prayer[]> {
    const ref = doc(db, "users", userId, "data", "prayers");
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        // Create empty doc if missing
        await setDoc(ref, { prayers: [] });
        return [];
    }

    const data = snap.data();
    return (data?.prayers as Prayer[]) ?? [];
}

// Add a prayer
export async function addPrayer(userId: string, text: string, color: string) {
    const ref = doc(db, "users", userId, "data", "prayers");
    const snap = await getDoc(ref);

    const existing = snap.exists() ? (snap.data()?.prayers as Prayer[]) ?? [] : [];

    const newPrayer: Prayer = {
        id: uuidv4(),
        text,
        color,
    };

    await setDoc(ref, { prayers: [...existing, newPrayer] }, { merge: true });
}

// Update a prayer
export async function updatePrayer(
    userId: string,
    prayerId: string,
    update: Partial<Prayer>
) {
    const ref = doc(db, "users", userId, "data", "prayers");
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const prayers = (snap.data()?.prayers as Prayer[]) ?? [];

    const updated = prayers.map((p) =>
        p.id === prayerId ? { ...p, ...update } : p
    );

    await updateDoc(ref, { prayers: updated });
}

