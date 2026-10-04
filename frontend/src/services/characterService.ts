import { db, storage } from "../firebase";
import { collection, doc, addDoc, getDocs, setDoc, updateDoc, getDoc, deleteDoc, arrayUnion, query, where, limit } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { sanitizeForFirestore } from "../utils/characterUtils";
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
    // enrich with base character transform data (read-only fallback) using targeted queries
    try {
      const entries = Object.entries(data) as [string, any][];
      await Promise.all(entries.map(async ([id, uc]) => {
        try {
          if (!uc || !uc.name) return;
          // skip only if every field we want is already present
          const missingTransform = !uc.transformAnimations || !uc.transformTempAnimations || !uc.transformThresholds;
          const missingAnimArrays = !uc.actionAnimations || !uc.damageAnimations || !uc.defeatAnimations || !uc.woundedAnimations;
          if (!missingTransform && !missingAnimArrays) return;

          // prefer a query by `name`
          const q = query(charactersRef, where('name', '==', uc.name), limit(1));
          const snap = await getDocs(q);
          let base: any = null;
          if (!snap.empty) {
            base = snap.docs[0].data();
          } else {
            // fallback: check for a doc with id === uc.name
            try {
              const docRef = doc(db, 'characters', uc.name);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) base = docSnap.data();
            } catch (e) {
              // ignore
            }
          }

          if (base) {
            if (!uc.transformAnimations && base.transformAnimations) uc.transformAnimations = base.transformAnimations;
            if (!uc.transformTempAnimations && base.transformTempAnimations) uc.transformTempAnimations = base.transformTempAnimations;
            if (!uc.transformThresholds && base.transformThresholds) uc.transformThresholds = base.transformThresholds;
            if (!uc.actionAnimations && base.actionAnimations) uc.actionAnimations = base.actionAnimations;
            if (!uc.damageAnimations && base.damageAnimations) uc.damageAnimations = base.damageAnimations;
            if (!uc.defeatAnimations && base.defeatAnimations) uc.defeatAnimations = base.defeatAnimations;
            if (!uc.woundedAnimations && base.woundedAnimations) uc.woundedAnimations = base.woundedAnimations;
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
      const uc = snap.data() as any;
      try {
        // try to find matching base character by name or id
        const baseSnap = await getDocs(charactersRef);
        let base: any = null;
        for (const b of baseSnap.docs) {
          const bd = b.data() as any;
          if (bd && (bd.name === uc.name || b.id === uc.name || b.id === characterId)) {
            base = bd;
            break;
          }
        }
        if (base) {
          if (!uc.transformAnimations && base.transformAnimations) uc.transformAnimations = base.transformAnimations;
          if (!uc.transformTempAnimations && base.transformTempAnimations) uc.transformTempAnimations = base.transformTempAnimations;
          if (!uc.transformThresholds && base.transformThresholds) uc.transformThresholds = base.transformThresholds;
          if (!uc.actionAnimations && base.actionAnimations) uc.actionAnimations = base.actionAnimations;
          if (!uc.damageAnimations && base.damageAnimations) uc.damageAnimations = base.damageAnimations;
          if (!uc.defeatAnimations && base.defeatAnimations) uc.defeatAnimations = base.defeatAnimations;
          if (!uc.woundedAnimations && base.woundedAnimations) uc.woundedAnimations = base.woundedAnimations;
        }
      } catch (err) {
        console.warn('getUserCharacter: could not lookup base character for transform fallback', err);
      }
      return uc as UserCharacterDataFirestore;
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

// --- Animation folders (per-user) ---
// We store the entire folder tree as a single document at
// users/{userId}/animations/root to keep reads/writes simple.

export const getUserAnimations = async (userId: string) => {
  if (!userId) return null;
  try {
    const ref = doc(db, 'users', userId, 'animations', 'root');
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.error('getUserAnimations: error', err);
    return null;
  }
};

export const saveUserAnimations = async (userId: string, payload: any) => {
  if (!userId) return;
  try {
    const ref = doc(db, 'users', userId, 'animations', 'root');
    const safe = sanitizeForFirestore(payload || {});
    await setDoc(ref, { ...safe, updatedAt: Date.now() }, { merge: true });
    console.debug('saveUserAnimations: saved for', userId);
  } catch (err) {
    console.error('saveUserAnimations: error', err);
    throw err;
  }
};

// --- Firebase Storage helpers for animation frames ---
// Upload an array of data-URL frames to Storage under
// users/{userId}/animations/{animId}/frames/frame_{i}.png
export const uploadAnimationFrames = async (userId: string, animId: string, frames: string[]) => {
  if (!userId || !animId || !Array.isArray(frames) || frames.length === 0) return null;
  try {
    const basePath = `users/${userId}/animations/${animId}/frames`;
    // upload each frame
    for (let i = 0; i < frames.length; i++) {
      const p = `${basePath}/frame_${i}.png`;
      const r = storageRef(storage, p);
      // frames[i] is expected to be a data URL
      await uploadString(r, frames[i], 'data_url');
    }
    // return storage prefix and a thumbnail URL (first frame)
    const firstRef = storageRef(storage, `${basePath}/frame_0.png`);
    const thumbnailUrl = await getDownloadURL(firstRef);
    return { storagePrefix: basePath, framesCount: frames.length, thumbnailUrl };
  } catch (err) {
    console.error('uploadAnimationFrames: error', err);
    throw err;
  }
};

// List and return ordered download URLs for frames under a storage prefix
export const getAnimationFrameUrls = async (storagePrefix: string) => {
  if (!storagePrefix) return [];
  try {
    const r = storageRef(storage, storagePrefix);
    const list = await listAll(r);
    // list.items may not be ordered; sort by name (frame_0.png, frame_1.png...)
    const items = (list.items || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const urls = await Promise.all(items.map(i => getDownloadURL(i)));
    return urls;
  } catch (err) {
    console.error('getAnimationFrameUrls: error', err);
    return [];
  }
};

// --- Pixel character sprite frames (Storage-hosted, code-free art pipeline) ---
// Upload PNG data-URL frames for a pixel character to
// `pixelCharacters/{characterId}/frame_{i}.png`. One frame is fine for a static sprite.
export const uploadPixelSpriteFrames = async (characterId: string, frames: string[]) => {
  if (!characterId || !Array.isArray(frames) || frames.length === 0) return null;
  try {
    const basePath = `pixelCharacters/${characterId}`;
    for (let i = 0; i < frames.length; i++) {
      const r = storageRef(storage, `${basePath}/frame_${i}.png`);
      await uploadString(r, frames[i], 'data_url');
    }
    return { storagePrefix: basePath, framesCount: frames.length };
  } catch (err) {
    console.error('uploadPixelSpriteFrames: error', err);
    throw err;
  }
};

export const deleteAnimationFiles = async (storagePrefix: string) => {
  if (!storagePrefix) return;
  try {
    const r = storageRef(storage, storagePrefix);
    const list = await listAll(r);
    const items = list.items || [];
    await Promise.all(items.map(i => deleteObject(i)));
    return true;
  } catch (err) {
    console.error('deleteAnimationFiles: error', err);
    throw err;
  }
};