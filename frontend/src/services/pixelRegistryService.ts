import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { PixelCharacter, PixelCharacterRarity } from '../components/pixels/pixelRegistry';

const CHARACTERS = 'pixelCharacters';
const GROUPS = 'pixelGroups';

export const slugify = (value: string) =>
    value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function subscribePixelCharacters(cb: (characters: PixelCharacter[]) => void) {
    return onSnapshot(collection(db, CHARACTERS), snap => {
        cb(snap.docs.map(d => {
            const data = d.data() as Partial<PixelCharacter>;
            return { id: d.id, name: data.name ?? d.id, group: data.group ?? '', rarity: (data.rarity ?? 'common') as PixelCharacterRarity };
        }));
    }, err => console.warn('pixel characters subscription failed', err));
}

export function subscribePixelGroups(cb: (groups: Record<string, string>) => void) {
    return onSnapshot(collection(db, GROUPS), snap => {
        const groups: Record<string, string> = {};
        snap.docs.forEach(d => { groups[d.id] = (d.data().label as string) || d.id; });
        cb(groups);
    }, err => console.warn('pixel groups subscription failed', err));
}

export async function savePixelGroup(id: string, label: string) {
    await setDoc(doc(db, GROUPS, id), { label });
}

export async function savePixelCharacter(character: PixelCharacter) {
    const { id, name, group, rarity } = character;
    await setDoc(doc(db, CHARACTERS, id), { name, group, rarity });
}

// Frames are stored as `frame_0.png`, `frame_1.png`, ... in the order given, which is
// the naming/ordering `usePixelSpriteFrames` expects.
export async function uploadPixelFrames(id: string, files: File[]) {
    await Promise.all(files.map((file, i) =>
        uploadBytes(storageRef(storage, `pixelCharacters/${id}/frame_${i}.png`), file, { contentType: 'image/png' })
    ));
}
