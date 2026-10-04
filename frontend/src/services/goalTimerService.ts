import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export type GoalTimerLevel = "simple" | "complex" | "challenging";

export interface GoalTimer {
    id: string;
    title: string;
    notes: string;
    color: string;
    level: GoalTimerLevel;
    minutes: number;
    createdAt: number;
}

// Firestore path helper — keeps everything consistent
function goalTimersRef(userId: string) {
    return doc(db, "users", userId, "data", "goalTimers");
}

// --- Fetch all saved goal timers ---
export async function getGoalTimers(userId: string): Promise<GoalTimer[]> {
    const ref = goalTimersRef(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return [];

    return (snap.data().timers as GoalTimer[]) ?? [];
}

// --- Add a new goal timer preset ---
export async function addGoalTimer(
    userId: string,
    data: Omit<GoalTimer, "id" | "createdAt">
): Promise<GoalTimer> {
    const ref = goalTimersRef(userId);
    const snap = await getDoc(ref);

    const timers: GoalTimer[] = snap.exists()
        ? (snap.data().timers as GoalTimer[]) ?? []
        : [];

    const newTimer: GoalTimer = {
        ...data,
        id: uuidv4(),
        createdAt: Date.now(),
    };

    await setDoc(ref, { timers: [...timers, newTimer] }, { merge: true });
    return newTimer;
}

// --- Update a goal timer by ID ---
export async function updateGoalTimer(
    userId: string,
    timerId: string,
    update: Partial<Omit<GoalTimer, "id">>
): Promise<void> {
    const ref = goalTimersRef(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const timers: GoalTimer[] = snap.data().timers ?? [];

    const updated = timers.map((t) =>
        t.id === timerId ? { ...t, ...update } : t
    );

    await setDoc(ref, { timers: updated }, { merge: true });
}

// --- Delete a goal timer by ID ---
export async function deleteGoalTimer(userId: string, timerId: string): Promise<void> {
    const ref = goalTimersRef(userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const timers: GoalTimer[] = snap.data().timers ?? [];

    await setDoc(ref, { timers: timers.filter((t) => t.id !== timerId) }, { merge: true });
}
