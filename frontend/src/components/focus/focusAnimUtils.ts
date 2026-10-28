import { ref, listAll } from "firebase/storage";
import { storage } from "../../firebase";

// Backdrop animation tiers keyed by minimum prayer level.
// Upload files to Firebase Storage at the paths listed below.
// Add more entries (in ascending level order) as new animations become available.
export const FOCUS_ANIMATION_TIERS: { minLevel: number; path: string }[] = [
    { minLevel: 1,  path: 'focus/animation.mp4'     }, // default
    { minLevel: 5,  path: 'focus/animation_l5.mp4'  },
    { minLevel: 10, path: 'focus/animation_l10.mp4' },
    { minLevel: 20, path: 'focus/animation_l20.mp4' },
];

// Backdrop animations cycled through, one step per saved prayer.
// Add or reorder Storage paths here.
export const FOCUS_ANIMATION_CYCLE: string[] = FOCUS_ANIMATION_TIERS.map(t => t.path);

export const FOCUS_ANIMATION_FOLDER = 'focus/backdrops';

/** Lists videos in Firebase Storage `focus/backdrops/` (sorted by name); falls back to the defaults. */
export async function loadFocusAnimPaths(): Promise<string[]> {
    try {
        const res = await listAll(ref(storage, FOCUS_ANIMATION_FOLDER));
        const paths = res.items.map(i => i.fullPath).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (paths.length) return paths;
    } catch (err) {
        console.warn('loadFocusAnimPaths failed', err);
    }
    return FOCUS_ANIMATION_CYCLE;
}

const CYCLE_KEY = 'focusAnimCycleIndex';

export function loadAnimCycleIndex(): number {
    const n = parseInt(localStorage.getItem(CYCLE_KEY) ?? '0', 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function nextAnimCycleIndex(current: number, length: number): number {
    const next = (current + 1) % Math.max(length, 1);
    localStorage.setItem(CYCLE_KEY, String(next));
    return next;
}

/** Returns the Storage path for the highest tier the player has unlocked. */
export function focusAnimPath(prayerLevel: number): string {
    let path = FOCUS_ANIMATION_TIERS[0].path;
    for (const tier of FOCUS_ANIMATION_TIERS) {
        if (prayerLevel >= tier.minLevel) path = tier.path;
    }
    return path;
}
