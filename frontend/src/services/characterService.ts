// src/services/characterService.ts
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

const charactersRef = collection(db, "characters");

export const addCharacter = async (characterData: { name: string; level: number }) => {
  try {
    const docRef = await addDoc(charactersRef, characterData);
    console.log("✅ Character added with ID:", docRef.id);
  } catch (error) {
    console.error("❌ Error adding character:", error);
  }
};

export const getCharacters = async () => {
  try {
    const snapshot = await getDocs(charactersRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ Error fetching characters:", error);
    return [];
  }
};

export const addCharacterToUser = async (
  userId: string,
  characterName: string
) => {
  try {
    const userCharactersRef = collection(db, "users", userId, "characters");
    await addDoc(userCharactersRef, {
      name: characterName,
      createdAt: new Date(),
    });
    console.log(`✅ Added ${characterName} for user ${userId}`);
  } catch (error) {
    console.error("❌ Error adding character:", error);
  }
};
