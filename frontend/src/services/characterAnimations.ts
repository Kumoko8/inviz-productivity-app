import { db, storage } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { sanitizeForFirestore } from "../utils/characterUtils";

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