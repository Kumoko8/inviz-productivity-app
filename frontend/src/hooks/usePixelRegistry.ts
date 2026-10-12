import { useEffect, useState } from 'react';
import { setRemoteRegistry, PixelCharacter } from '../components/pixels/pixelRegistry';
import { subscribePixelCharacters, subscribePixelGroups } from '../services/pixelRegistryService';

// Shared subscription: one pair of Firestore listeners no matter how many components use the hook.
let characters: PixelCharacter[] = [];
let groups: Record<string, string> = {};
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | null = null;

const publish = () => {
    setRemoteRegistry(characters, groups);
    listeners.forEach(l => l());
};

const start = () => {
    const u1 = subscribePixelCharacters(c => { characters = c; publish(); });
    const u2 = subscribePixelGroups(g => { groups = g; publish(); });
    unsubscribe = () => { u1(); u2(); };
};

// Subscribes to the Firestore-backed pixel registry and re-renders the caller when it changes.
export default function usePixelRegistry() {
    const [, setTick] = useState(0);
    useEffect(() => {
        const l = () => setTick(t => t + 1);
        listeners.add(l);
        if (listeners.size === 1) start();
        return () => {
            listeners.delete(l);
            if (listeners.size === 0 && unsubscribe) { unsubscribe(); unsubscribe = null; }
        };
    }, []);
}
