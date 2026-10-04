import { db, storage } from '../firebase';
import { collection, addDoc, getDocs, orderBy, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export interface DrawingRecord {
    id?: string;
    date: number;
    /** Resolved URL (Storage download URL, or legacy base64 data URL) */
    dataUrl: string;
    /** Storage path stored so we can delete the file later */
    storagePath?: string;
}

// Firestore path: users/{uid}/characters/{charId}/drawings
function drawingsRef(uid: string, charId: string) {
    return collection(db, 'users', uid, 'characters', charId, 'drawings');
}

export async function addDrawing(
    uid: string,
    charId: string,
    blob: Blob
): Promise<DrawingRecord> {
    const date = Date.now();
    const path = `drawings/${uid}/${charId}/${date}.jpg`;
    const sRef = storageRef(storage, path);
    await uploadBytes(sRef, blob, { contentType: 'image/jpeg' });
    const downloadUrl = await getDownloadURL(sRef);
    const fsRef = drawingsRef(uid, charId);
    const docRef = await addDoc(fsRef, { date, storagePath: path, dataUrl: downloadUrl });
    return { id: docRef.id, date, dataUrl: downloadUrl, storagePath: path };
}

export async function getDrawings(uid: string, charId: string): Promise<DrawingRecord[]> {
    const fsRef = drawingsRef(uid, charId);
    const q = query(fsRef, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<DrawingRecord, 'id'>),
    }));
}

export async function deleteDrawing(uid: string, charId: string, drawingId: string, storagePath?: string): Promise<void> {
    // Delete Firestore record
    await deleteDoc(doc(db, 'users', uid, 'characters', charId, 'drawings', drawingId));
    // Delete Storage file if path is known (legacy data-URL records have no storagePath)
    if (storagePath) {
        try {
            await deleteObject(storageRef(storage, storagePath));
        } catch {
            // Non-fatal — file may already be gone
        }
    }
}
