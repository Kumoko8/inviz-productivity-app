import { db } from "../firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import type { CustomTrainingSeries, CustomQuestionItem } from "../types/customTraining";

const seriesCol = (uid: string) => collection(db, "users", uid, "customTrainingSeries");

export const getCustomTrainingSeries = async (uid: string): Promise<CustomTrainingSeries[]> => {
    try {
        const q = query(seriesCol(uid), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomTrainingSeries));
    } catch (err) {
        console.error("Failed to fetch custom training series:", err);
        return [];
    }
};

export const createCustomTrainingSeries = async (
    uid: string,
    topicName: string,
    subtopicName: string
): Promise<CustomTrainingSeries | null> => {
    try {
        const now = Date.now();
        const data = {
            topicName,
            subtopicName,
            createdAt: now,
            updatedAt: now,
            questions: { 1: [], 2: [], 3: [] } as CustomTrainingSeries["questions"],
        };
        const ref = await addDoc(seriesCol(uid), data);
        return { id: ref.id, ...data };
    } catch (err) {
        console.error("Failed to create custom training series:", err);
        return null;
    }
};

// Replaces the full question array for one level (caller computes the merged/edited array)
export const setSeriesQuestionsForLevel = async (
    uid: string,
    seriesId: string,
    level: 1 | 2 | 3,
    questions: CustomQuestionItem[]
): Promise<void> => {
    try {
        const ref = doc(db, "users", uid, "customTrainingSeries", seriesId);
        await updateDoc(ref, {
            [`questions.${level}`]: questions,
            updatedAt: Date.now(),
        });
    } catch (err) {
        console.error("Failed to save questions for series:", err);
    }
};

export const deleteCustomTrainingSeries = async (uid: string, seriesId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, "users", uid, "customTrainingSeries", seriesId));
    } catch (err) {
        console.error("Failed to delete custom training series:", err);
    }
};

export const renameCustomSubtopic = async (
    uid: string,
    seriesId: string,
    newSubtopicName: string
): Promise<void> => {
    try {
        await updateDoc(doc(db, "users", uid, "customTrainingSeries", seriesId), {
            subtopicName: newSubtopicName,
            updatedAt: Date.now(),
        });
    } catch (err) {
        console.error("Failed to rename custom subtopic:", err);
    }
};

// Renames a topic across all its series (topicName is denormalized onto each series doc)
export const renameCustomTopic = async (
    uid: string,
    seriesIds: string[],
    newTopicName: string
): Promise<void> => {
    try {
        const now = Date.now();
        await Promise.all(seriesIds.map(id =>
            updateDoc(doc(db, "users", uid, "customTrainingSeries", id), { topicName: newTopicName, updatedAt: now })
        ));
    } catch (err) {
        console.error("Failed to rename custom topic:", err);
    }
};

// Deletes every series under a topic (caller supplies the ids to delete)
export const deleteCustomTopic = async (uid: string, seriesIds: string[]): Promise<void> => {
    try {
        await Promise.all(seriesIds.map(id => deleteDoc(doc(db, "users", uid, "customTrainingSeries", id))));
    } catch (err) {
        console.error("Failed to delete custom topic:", err);
    }
};
