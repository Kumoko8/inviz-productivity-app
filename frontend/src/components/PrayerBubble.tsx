import React, { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
} from "firebase/firestore";
import { Prayer } from "../types/character";

interface Props {
    characterId: string;
}

const PrayerBubble: React.FC<Props> = ({ characterId }) => {
    const user = auth.currentUser;
    const uid = user?.uid;
    const [prayers, setPrayers] = useState<Prayer[]>([]);
    const [newPrayer, setNewPrayer] = useState("");
    const [previewColor, setPreviewColor] = useState("#fff3b0"); // default light yellow

    // --------------------------
    // Load prayers for this character
    // --------------------------
    useEffect(() => {
        if (!uid || !characterId) return;

        const load = async () => {
            const ref = collection(db, "users", uid, "characters", characterId, "prayers");
            const snap = await getDocs(ref);

            const items: Prayer[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
            }));

            setPrayers(items);
        };

        load().catch(console.error);
    }, [uid, characterId]);

    // --------------------------
    // Add a prayer
    // --------------------------
    const addPrayer = async () => {
        if (!uid || !characterId || !newPrayer.trim()) return;

        const ref = collection(db, "users", uid, "characters", characterId, "prayers");

        const docRef = await addDoc(ref, {
            text: newPrayer,
            color: previewColor,
            createdAt: Date.now(),
        });

        setPrayers((prev) => [
            { id: docRef.id, text: newPrayer, color: previewColor },
            ...prev,
        ]);

        setNewPrayer("");
    };

    // --------------------------
    // Update prayer color
    // --------------------------
    const updatePrayerColor = async (id: string, color: string) => {
        if (!uid || !characterId) return;

        const ref = doc(db, "users", uid, "characters", characterId, "prayers", id);
        await updateDoc(ref, { color });

        setPrayers((prev) =>
            prev.map((p) => (p.id === id ? { ...p, color } : p))
        );
    };

    // --------------------------
    // Delete prayer
    // --------------------------
    const deletePrayer = async (id: string) => {
        if (!uid || !characterId) return;

        const ref = doc(db, "users", uid, "characters", characterId, "prayers", id);
        await deleteDoc(ref);

        setPrayers((prev) => prev.filter((p) => p.id !== id));
    };

    // --------------------------
    // UI
    // --------------------------
    return (
        <div className="w-full max-w-md bg-white shadow-md rounded-lg border border-cyan-200 p-6 mb-8">
            <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">
                Prayers
            </h2>

            {/* New prayer input */}
            <div className="flex flex-col gap-3 mb-4">
                <input
                    value={newPrayer}
                    onChange={(e) => setNewPrayer(e.target.value)}
                    placeholder="Enter prayer..."
                    className="border rounded px-3 py-2"
                    style={{ backgroundColor: previewColor }}
                />

                {/* Color preview selectors */}
                <div className="flex gap-2">
                    {["#fff3b0", "#ffd6e0", "#caffbf", "#bde0fe"].map((c) => (
                        <button
                            key={c}
                            onClick={() => setPreviewColor(c)}
                            style={{ backgroundColor: c }}
                            className="w-8 h-8 rounded-full border"
                        />
                    ))}
                </div>

                <button
                    onClick={addPrayer}
                    className="px-3 py-2 bg-cyan-500 text-white rounded"
                >
                    Add Prayer
                </button>
            </div>

            {/* Existing prayers */}
            <div className="flex flex-col gap-3">
                {prayers.map((p) => (
                    <div
                        key={p.id}
                        className="p-3 rounded shadow flex items-center justify-between"
                        style={{ backgroundColor: p.color }}
                    >
                        <span>{p.text}</span>

                        <div className="flex items-center gap-2">
                            {/* Color bubbles */}
                            {["#fff3b0", "#ffd6e0", "#caffbf", "#bde0fe"].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => updatePrayerColor(p.id, c)}
                                    className="w-5 h-5 rounded-full border"
                                    style={{ backgroundColor: c }}
                                />
                            ))}

                            <button
                                onClick={() => deletePrayer(p.id)}
                                className="text-red-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrayerBubble;