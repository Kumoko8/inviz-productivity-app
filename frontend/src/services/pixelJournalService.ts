import { collection, deleteField, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';

const CREATURES = 'pixelJournalCreatures';
const ENTRIES = 'pixelJournalEntries';

// Frames live at `${JOURNAL_STORAGE_PATH}/{id}/frame_N.png`, the layout `PixelSprite` loads.
export const JOURNAL_STORAGE_PATH = 'pixelJournal';

export type JournalCreature = { id: string; name: string };
// `date` is a local calendar day (YYYY-MM-DD); `creatures` maps creature id -> how many were seen.
export type JournalEntry = { date: string; creatures: Record<string, number> };

export function subscribeJournalCreatures(cb: (creatures: JournalCreature[]) => void) {
    return onSnapshot(collection(db, CREATURES), snap => {
        cb(snap.docs.map(d => ({ id: d.id, name: (d.data().name as string) || d.id })));
    }, err => console.warn('journal creatures subscription failed', err));
}

export function subscribeJournalEntries(cb: (entries: JournalEntry[]) => void) {
    return onSnapshot(collection(db, ENTRIES), snap => {
        cb(snap.docs.map(d => ({ date: d.id, creatures: (d.data().creatures as Record<string, number>) ?? {} })));
    }, err => console.warn('journal entries subscription failed', err));
}

// Uploads the frames first so a creature never exists in Firestore without art.
export async function createJournalCreature(id: string, name: string, files: File[]) {
    await Promise.all(files.map((file, i) =>
        uploadBytes(storageRef(storage, `${JOURNAL_STORAGE_PATH}/${id}/frame_${i}.png`), file, { contentType: 'image/png' })
    ));
    await setDoc(doc(db, CREATURES, id), { name });
}

export async function setEntryCreatureCount(date: string, creatureId: string, count: number) {
    await setDoc(doc(db, ENTRIES, date), { date, creatures: { [creatureId]: count } }, { merge: true });
}

export async function removeEntryCreature(date: string, creatureId: string) {
    await updateDoc(doc(db, ENTRIES, date), { [`creatures.${creatureId}`]: deleteField() });
}
