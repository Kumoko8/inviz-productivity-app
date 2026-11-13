import { db, storage } from "../firebase";
import { collection, doc, addDoc, getDocs, setDoc, updateDoc, getDoc, deleteDoc, query, where, limit } from "firebase/firestore";
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { sanitizeForFirestore } from "../utils/characterUtils";
import { BaseCharacterFirestore, UserCharacterDataFirestore } from "../types/character";
import { needsCharacterAnimationFallback, withCharacterAnimationFallback } from "../utils/characterAnimationFallback";

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

// Uploads a ClassMode still image to characters/<name>/stills/<fileName> and points the
// character's stillFrames[state] at it (base doc, plus the user's copy when it has its own map).
export const uploadCharacterStill = async (
  opts: { characterId: string; characterName: string; uid?: string | null; state: string; fileName: string; blob: Blob; userStillFrames?: Record<string, string> }
): Promise<string> => {
  const folder = opts.characterName.toLowerCase().trim();
  const path = `characters/${folder}/stills/${opts.fileName}`;
  await uploadBytes(storageRef(storage, path), opts.blob, { contentType: 'image/png' });
  const baseRef = doc(db, "characters", opts.characterId);
  const baseSnap = await getDoc(baseRef);
  const baseFrames = (baseSnap.exists() ? baseSnap.data().stillFrames : undefined) || {};
  await updateDoc(baseRef, { stillFrames: { ...baseFrames, [opts.state]: path } });
  if (opts.uid && opts.userStillFrames) {
    await updateUserCharacter(opts.uid, opts.characterId, { stillFrames: { ...opts.userStillFrames, [opts.state]: path } } as any);
  }
  return path;
};

// Fetch all base characters
export const getCharacters = async (): Promise<BaseCharacterFirestore[]> => {
  try {
    const snapshot = await getDocs(charactersRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BaseCharacterFirestore));
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
export const getUserCharacters = async (
  userId: string,
  baseCharacters?: BaseCharacterFirestore[] | Promise<BaseCharacterFirestore[]>
): Promise<Record<string, UserCharacterDataFirestore>> => {
  try {
    const userCharsRef = collection(db, "users", userId, "characters");
    const snapshot = await getDocs(userCharsRef);
    const data: Record<string, UserCharacterDataFirestore> = {};
    snapshot.docs.forEach(docSnap => {
      data[docSnap.id] = { ...docSnap.data(), id: docSnap.id } as UserCharacterDataFirestore;
    });
    const bases = baseCharacters ? await baseCharacters : undefined;
    // enrich with base character transform data (read-only fallback) using targeted queries
    try {
      const entries = Object.entries(data);
      await Promise.all(entries.map(async ([id, uc]) => {
        try {
          if (!uc || !uc.name) return;
          // skip only if every field we want is already present
          if (!needsCharacterAnimationFallback(uc)) return;

          let base: BaseCharacterFirestore | null = null;
          if (bases) {
            // already-fetched base list: no extra round trips
            base = bases.find(b => b.name === uc.name || b.id === uc.name) || null;
          } else {
            const q = query(charactersRef, where('name', '==', uc.name), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) base = snap.docs[0].data() as BaseCharacterFirestore;
          }
          if (!base && !bases) {
            // fallback: check for a doc with id === uc.name
            try {
              const docRef = doc(db, 'characters', uc.name);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) base = docSnap.data() as BaseCharacterFirestore;
            } catch (e) {
              console.warn('getUserCharacters: base document lookup failed for', uc.name, e);
            }
          }

          if (base) {
            data[id] = withCharacterAnimationFallback(uc, base);
          }
        } catch (innerErr) {
          console.warn('getUserCharacters: lookup failed for', uc?.name, innerErr);
        }
      }));
    } catch (err) {
      console.warn('getUserCharacters: could not enrich with base character transforms', err);
    }

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
    if (snap.exists()) {
      const uc = snap.data() as UserCharacterDataFirestore;
      let result = uc;
      try {
        // try to find matching base character by name or id
        const baseSnap = await getDocs(charactersRef);
        let base: BaseCharacterFirestore | null = null;
        for (const b of baseSnap.docs) {
          const bd = b.data() as BaseCharacterFirestore;
          if (bd && (bd.name === uc.name || b.id === uc.name || b.id === characterId)) {
            base = bd;
            break;
          }
        }
        if (base) {
          result = withCharacterAnimationFallback(uc, base);
        }
      } catch (err) {
        console.warn('getUserCharacter: could not lookup base character for transform fallback', err);
      }
      return { ...result, id: characterId };
    }
    return null;
  } catch (error) {
    console.error("❌ Error fetching user character:", error);
    return null;
  }
};

// Save (set with merge) a user's character document. This mirrors the previous
// inline `saveCharacter` implementation used by the Dashboard: it sanitizes
// the payload and writes with merge:true so concurrent creations don't clobber.
export const saveUserCharacter = async (userId: string, c: any) => {
  if (!userId || !c?.id) return;
  const ref = doc(db, "users", userId, "characters", c.id);
  const payload = {
    hp: c.hp,
    maxHp: c.maxHp,
    xp: c.xp,
    level: c.level,
    skills: c.skills ?? [],
    // archivedSkills: c.archivedSkills ?? [],
    createdAt: c.createdAt ?? Date.now(),
    animation: c.animation,
    playerName: c.playerName ?? '',
    characterGroup: c.characterGroup ?? '',
    transformIndex: c.transformIndex ?? 0,
    prayerPoints: c.prayerPoints ?? 0,
    prayerLevel: c.prayerLevel ?? 1,
  };

  // persist spendable currency XP when provided
  if (typeof c.currencyXp === 'number') {
    // store as integer
    (payload as any).currencyXp = Math.max(0, Math.floor(c.currencyXp));
  }

  // persist per-character store price overrides when provided
  if (c.storePrices && typeof c.storePrices === 'object') {
    (payload as any).storePrices = c.storePrices;
  }

  // Merge archivedSkills with server-side copy to avoid accidental overwrites
  // try {
  //   const snap = await getDoc(ref);
  //   if (snap.exists()) {
  //     const existing = snap.data() as any;
  //     const existingArchived: any[] = existing.archivedSkills ?? [];
  //     const incomingArchived: any[] = payload.archivedSkills ?? [];
  //     if (incomingArchived.length > 0) {
  //       // merge preserving existing items and newest incoming items, dedupe by id
  //       const map = new Map<string, any>();
  //       for (const it of existingArchived) map.set(it.id, it);
  //       for (const it of incomingArchived) map.set(it.id, it);
  //       const merged = Array.from(map.values()).sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  //       payload.archivedSkills = merged;
  //     } else {
  //       payload.archivedSkills = existingArchived;
  //     }
  //   }

    const safePayload = sanitizeForFirestore(payload);
    console.debug('characterService.saveUserCharacter: writing', { userId, id: c.id, payload: safePayload });
    await setDoc(ref, safePayload, { merge: true });
    console.debug('characterService.saveUserCharacter: success', c.id);
  // } catch (err) {
  //   console.error('characterService.saveUserCharacter: error writing character', c.id, err);
  //   throw err;
  // }
};

// Low-level helper to set (merge) a user character payload by id.
export const writeUserCharacter = async (userId: string, characterId: string, payload: any) => {
  if (!userId || !characterId) return;
  const ref = doc(db, "users", userId, "characters", characterId);
  const safePayload = sanitizeForFirestore(payload);
  try {
    console.debug('characterService.writeUserCharacter: writing', { userId, id: characterId, payload: safePayload });
    await setDoc(ref, safePayload, { merge: true });
    console.debug('characterService.writeUserCharacter: success', characterId);
  } catch (err) {
    console.error('characterService.writeUserCharacter: error writing character', characterId, err);
    throw err;
  }
};

// Append an archived skill to a character's `archivedSkills` array using arrayUnion
// export const appendArchivedSkill = async (userId: string, characterId: string, archivedItem: any, nextSkills?: any[]) => {
//   if (!userId || !characterId || !archivedItem) return;
//   const ref = doc(db, 'users', userId, 'characters', characterId);
//   const payload: any = { archivedSkills: arrayUnion(sanitizeForFirestore(archivedItem)) };
//   if (nextSkills) payload.skills = nextSkills;
//   try {
//     await updateDoc(ref, payload);
//     console.debug('characterService.appendArchivedSkill: appended archived item', { userId, characterId, archivedItem });
//   } catch (err) {
//     console.error('characterService.appendArchivedSkill: error', err);
//     throw err;
//   }
// };

// Append multiple archived items at once
// export const appendArchivedSkills = async (userId: string, characterId: string, archivedItems: any[], nextSkills?: any[]) => {
//   if (!userId || !characterId || !Array.isArray(archivedItems) || archivedItems.length === 0) return;
//   const ref = doc(db, 'users', userId, 'characters', characterId);
//   const safeItems = archivedItems.map(sanitizeForFirestore);
//   try {
//     await updateDoc(ref, { archivedSkills: arrayUnion(...safeItems), ...(nextSkills ? { skills: nextSkills } : {}) });
//     console.debug('characterService.appendArchivedSkills: appended items', { userId, characterId, count: archivedItems.length });
//   } catch (err) {
//     console.error('characterService.appendArchivedSkills: error', err);
//     throw err;
//   }
// };

// Add a new per-user character doc with a generated ID (returns new id)
export const addUserCharacter = async (userId: string, payload: any) => {
  if (!userId) throw new Error('Missing userId');
  try {
    // Do NOT copy transform data into per-user docs; these should remain in the global `characters` collection.
    // Remove any transform fields that may have been accidentally included on the payload.
    if (payload) {
      delete payload.transformAnimations;
      delete payload.transformTempAnimations;
      delete payload.transformThresholds;
    }

    const ref = await addDoc(collection(db, 'users', userId, 'characters'), payload);
    return ref.id;
  } catch (err) {
    console.error('addUserCharacter: error creating user character', err);
    throw err;
  }
};

export const deleteUserCharacter = async (userId: string, characterId: string) => {
  if (!userId || !characterId) throw new Error('Missing userId or characterId');
  const ref = doc(db, 'users', userId, 'characters', characterId);
  await deleteDoc(ref);
};

export { addPrayerToCharacter, updatePrayerForCharacter, deletePrayerFromCharacter, addItemToCharacter, updateItemForCharacter, deleteItemFromCharacter, getItemsForCharacter } from "./characterSubcollections";
export { getUserAnimations, saveUserAnimations, uploadAnimationFrames, getAnimationFrameUrls, uploadPixelSpriteFrames, deleteAnimationFiles } from "./characterAnimations";
