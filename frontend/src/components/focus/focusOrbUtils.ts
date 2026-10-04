export const CMY_PALETTE: string[] = [
    // Cyans
    '#00f5ff', '#00e5d0', '#22d3ee', '#67e8f9', '#a5f3fc', '#0891b2', '#06b6d4', '#cffafe',
    // Magentas
    '#ff00ff', '#e879f9', '#d946ef', '#f0abfc', '#f472b6', '#ec4899', '#fce7f3', '#c026d3',
    // Yellows
    '#fef08a', '#fde047', '#facc15', '#fbbf24', '#fef9c3', '#fef3c7', '#eab308', '#ffd700',
];

// Shades of green used for grouped-orb clusters.
export const GREEN_PALETTE: string[] = [
    '#86d0a3', '#83b8ad', '#86dfc8', '#77be91', '#9cf29c',
    '#4ade80', '#86efac', '#a2ce69', '#86e6cd', '#84cc16',
];

export interface PrayOrb {
    id: string;
    x: number;
    y: number;
    color: string;
    text?: string;
    imageUrl?: string;
}

/** A cluster of prayer orbs, collapsed into one larger glowing orb until expanded. */
export interface PrayOrbGroup {
    id: string;
    x: number;
    y: number;
    color: string;
    orbs: PrayOrb[];
    expanded: boolean;
}

/** Round-robins through the green palette based on how many groups already exist. */
export function nextGroupColor(existingGroupCount: number): string {
    return GREEN_PALETTE[existingGroupCount % GREEN_PALETTE.length];
}

// Safe zones (matching the overlay layout):
//   top-left  : progress bar  x<24%,  y<18%
//   top-right : close button  x>82%,  y<12%
//   bottom-mid: Pray button   x 28–72%, y>76%
function isSafe(x: number, y: number): boolean {
    if (x < 24 && y < 18) return false;
    if (x > 82 && y < 12) return false;
    if (x > 28 && x < 72 && y > 76) return false;
    return true;
}

export function randomOrbPosition(): { x: number; y: number } {
    for (let i = 0; i < 60; i++) {
        const x = 6 + Math.random() * 88;
        const y = 6 + Math.random() * 88;
        if (isSafe(x, y)) return { x, y };
    }
    return { x: 50, y: 45 };
}

/** Deterministic position from a numeric seed (e.g. createdAt). */
export function seededOrbPosition(seed: number): { x: number; y: number } {
    let s = Math.abs(seed) % 2147483647 || 1;
    const next = (n: number) => (n * 16807) % 2147483647;
    for (let attempt = 0; attempt < 60; attempt++) {
        s = next(s); const rx = s / 2147483647;
        s = next(s); const ry = s / 2147483647;
        const x = 6 + rx * 88;
        const y = 6 + ry * 88;
        if (isSafe(x, y)) return { x, y };
    }
    return { x: 50, y: 45 };
}

/** Deterministic color from a numeric seed. */
export function seededOrbColor(seed: number): string {
    let s = Math.abs(seed) % 2147483647 || 1;
    s = (s * 16807) % 2147483647;
    return CMY_PALETTE[s % CMY_PALETTE.length];
}
