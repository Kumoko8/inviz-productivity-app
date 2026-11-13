import { db } from "../firebase";
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

// --- Prayer helpers scoped to a specific character ---
export const addPrayerToCharacter = async (userId: string, characterId: string, prayer: { text: string; color: string }) => {
  if (!userId || !characterId) return null;
  const ref = collection(db, 'users', userId, 'characters', characterId, 'prayers');
  const docRef = await addDoc(ref, { ...prayer, createdAt: Date.now() });
  return docRef.id;
};

export const updatePrayerForCharacter = async (userId: string, characterId: string, prayerId: string, update: any) => {
  if (!userId || !characterId || !prayerId) return;
  const ref = doc(db, 'users', userId, 'characters', characterId, 'prayers', prayerId);
  await updateDoc(ref, update);
};

export const deletePrayerFromCharacter = async (userId: string, characterId: string, prayerId: string) => {
  if (!userId || !characterId || !prayerId) return;
  const ref = doc(db, 'users', userId, 'characters', characterId, 'prayers', prayerId);
  await deleteDoc(ref);
};

// Generic helpers for simple per-character subcollections (notes, prayers, etc.)
export const addItemToCharacter = async (userId: string, characterId: string, collectionName: string, item: any) => {
  if (!userId || !characterId || !collectionName) return null;
  const ref = collection(db, 'users', userId, 'characters', characterId, collectionName);
  const docRef = await addDoc(ref, { ...item, createdAt: Date.now() });
  return docRef.id;
};

export const updateItemForCharacter = async (userId: string, characterId: string, collectionName: string, itemId: string, update: any) => {
  if (!userId || !characterId || !collectionName || !itemId) return;
  const ref = doc(db, 'users', userId, 'characters', characterId, collectionName, itemId);
  await updateDoc(ref, update);
};

export const deleteItemFromCharacter = async (userId: string, characterId: string, collectionName: string, itemId: string) => {
  if (!userId || !characterId || !collectionName || !itemId) return;
  const ref = doc(db, 'users', userId, 'characters', characterId, collectionName, itemId);
  await deleteDoc(ref);
};

// Get all items for a character subcollection (e.g., 'notes', 'prayers', 'maps')
export const getItemsForCharacter = async (userId: string, characterId: string, collectionName: string) => {
  if (!userId || !characterId || !collectionName) return [];
  try {
    const ref = collection(db, 'users', userId, 'characters', characterId, collectionName);
    const snap = await getDocs(ref);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  } catch (err) {
    console.error('characterService.getItemsForCharacter: error', err);
    return [];
  }
};

