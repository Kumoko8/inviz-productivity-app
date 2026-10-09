import { db } from "../firebase";
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import type { TrainingSession, PuzzleSession } from "../types/trainingData";

export const addTrainingSession = async (
    uid: string,
    charId: string,
    session: Omit<TrainingSession, "id">
): Promise<void> => {
    try {
        const colRef = collection(db, "users", uid, "characters", charId, "trainingData");
        await addDoc(colRef, session);
    } catch (err) {
        console.error("Failed to save training session:", err);
    }
};

export const getTrainingSessions = async (
    uid: string,
    charId: string
): Promise<TrainingSession[]> => {
    try {
        const colRef = collection(db, "users", uid, "characters", charId, "trainingData");
        const q = query(colRef, orderBy("date", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingSession));
    } catch (err) {
        console.error("Failed to fetch training sessions:", err);
        return [];
    }
};

export const setTrainingSessionPctOverride = async (
    uid: string,
    charId: string,
    sessionId: string,
    pct: number
): Promise<void> => {
    const ref = doc(db, "users", uid, "characters", charId, "trainingData", sessionId);
    await updateDoc(ref, { pctOverride: pct });
};

export const addPuzzleSession = async (
    uid: string,
    charId: string,
    session: Omit<PuzzleSession, "id">
): Promise<void> => {
    try {
        const colRef = collection(db, "users", uid, "characters", charId, "puzzleData");
        await addDoc(colRef, session);
    } catch (err) {
        console.error("Failed to save puzzle session:", err);
    }
};

export const getPuzzleSessions = async (
    uid: string,
    charId: string
): Promise<PuzzleSession[]> => {
    try {
        const colRef = collection(db, "users", uid, "characters", charId, "puzzleData");
        const q = query(colRef, orderBy("date", "desc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as PuzzleSession));
    } catch (err) {
        console.error("Failed to fetch puzzle sessions:", err);
        return [];
    }
};
