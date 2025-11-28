import { db } from "../firebase";
import { collection, doc, addDoc, getDocs, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { BaseCharacterFirestore, UserCharacterDataFirestore } from "../types/character";

// Collection reference for base characters
const charactersRef = collection(db, "characters");

// --- Base Characters ---

// Add a new base character
export const addCharacter = async (characterData: BaseCharacterFirestore) => {
  try {
    const docRef = await addDoc(charactersRef, characterData);
    console.log("✅ Character added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("❌ Error adding character:", error);
    throw error;
  }
};

// Fetch all base characters
export const getCharacters = async (): Promise<BaseCharacterFirestore[]> => {
  try {
    const snapshot = await getDocs(charactersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BaseCharacterFirestore));
  } catch (error) {
    console.error("❌ Error fetching characters:", error);
    return [];
  }
};

// --- User-specific Characters ---

// Add a character entry for a user
export const addCharacterToUser = async (
  userId: string,
  characterId: string,
  initialData?: Partial<UserCharacterDataFirestore>
) => {
  try {
    const userCharRef = doc(db, "users", userId, "characters", characterId);
    await setDoc(userCharRef, {
      xp: 0,
      level: 1,
      hp: 100,
      maxHp: 100,
      createdAt: new Date(),
      ...initialData
    });
    console.log(`✅ Added character ${characterId} for user ${userId}`);
  } catch (error) {
    console.error("❌ Error adding character to user:", error);
    throw error;
  }
};

// Get all characters for a user
export const getUserCharacters = async (userId: string): Promise<Record<string, UserCharacterDataFirestore>> => {
  try {
    const userCharsRef = collection(db, "users", userId, "characters");
    const snapshot = await getDocs(userCharsRef);
    const data: Record<string, UserCharacterDataFirestore> = {};
    snapshot.docs.forEach(docSnap => {
      data[docSnap.id] = docSnap.data() as UserCharacterDataFirestore;
    });
    return data;
  } catch (error) {
    console.error("❌ Error fetching user characters:", error);
    return {};
  }
};

// Update a user's character
export const updateUserCharacter = async (
  userId: string,
  characterId: string,
  updates: Partial<UserCharacterDataFirestore>
) => {
  try {
    const userCharRef = doc(db, "users", userId, "characters", characterId);
    await updateDoc(userCharRef, updates);
    console.log(`✅ Updated character ${characterId} for user ${userId}`);
  } catch (error) {
    console.error("❌ Error updating user character:", error);
    throw error;
  }
};

// Fetch a single user character
export const getUserCharacter = async (
  userId: string,
  characterId: string
): Promise<UserCharacterDataFirestore | null> => {
  try {
    const userCharRef = doc(db, "users", userId, "characters", characterId);
    const snap = await getDoc(userCharRef);
    if (snap.exists()) return snap.data() as UserCharacterDataFirestore;
    return null;
  } catch (error) {
    console.error("❌ Error fetching user character:", error);
    return null;
  }
};