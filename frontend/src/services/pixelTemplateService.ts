import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { slugify } from './pixelRegistryService';

const TEMPLATES = 'pixelTemplates';

// A 32x32 canvas as a PNG data URL is only a few hundred bytes, so it is stored directly
// in the Firestore doc (no Storage upload, and no CORS issues when loading it back onto a canvas).
export type PixelTemplate = { id: string; name: string; dataUrl: string };

export function subscribePixelTemplates(cb: (templates: PixelTemplate[]) => void) {
    return onSnapshot(collection(db, TEMPLATES), snap => {
        cb(snap.docs
            .map(d => ({ id: d.id, name: (d.data().name as string) || d.id, dataUrl: (d.data().dataUrl as string) || '' }))
            .filter(t => t.dataUrl)
            .sort((a, b) => a.name.localeCompare(b.name)));
    }, err => console.warn('pixel templates subscription failed', err));
}

export async function savePixelTemplate(name: string, dataUrl: string) {
    const id = slugify(name);
    if (!id) throw new Error('Enter a valid template name.');
    await setDoc(doc(db, TEMPLATES, id), { name, dataUrl });
}

export const deletePixelTemplate = (id: string) => deleteDoc(doc(db, TEMPLATES, id));
