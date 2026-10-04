import { useEffect, useState } from 'react';
import { ref as storageRef, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

// Module-level cache so every gallery tile/instance sharing a character id
// re-uses a single Storage listing + download-url fetch instead of refetching.
const frameCache = new Map<string, Promise<string[]>>();

const fetchFrames = (id: string): Promise<string[]> => {
    let pending = frameCache.get(id);
    if (!pending) {
        pending = (async () => {
            try {
                const folderRef = storageRef(storage, `pixelCharacters/${id}`);
                const list = await listAll(folderRef);
                const items = (list.items || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                return await Promise.all(items.map(item => getDownloadURL(item)));
            } catch (err) {
                console.warn('usePixelSpriteFrames: could not load frames for', id, err);
                return [];
            }
        })();
        frameCache.set(id, pending);
    }
    return pending;
};

// Fetches ordered frame download URLs for a pixel character stored at
// Storage path `pixelCharacters/{id}/frame_N.png` (any image count, including a single static frame).
export default function usePixelSpriteFrames(id: string) {
    const [frames, setFrames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetchFrames(id).then(urls => {
            if (!mounted) return;
            setFrames(urls);
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [id]);

    return { frames, loading };
}
