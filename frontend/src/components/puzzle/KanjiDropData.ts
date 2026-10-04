// ─── Tile definitions ─────────────────────────────────────────────────────────
export interface TileDef {
    id: string;
    char: string;
    meaning: string;
    tier: number;
    color: string;
    textColor: string;
    radius: number;
}

export interface TileDefExt extends TileDef { glow: string; }

// Vibrant gooey colors per tier
const TIER_COLORS: { fill: string; text: string; glow: string }[] = [
    { fill: '#0ea5e9', text: '#f0f9ff', glow: '#38bdf8' },
    { fill: '#22c55e', text: '#f0fdf4', glow: '#4ade80' },
    { fill: '#f59e0b', text: '#fffbeb', glow: '#fbbf24' },
    { fill: '#d946ef', text: '#fdf4ff', glow: '#e879f9' },
    { fill: '#285aa9', text: '#eff6ff', glow: '#60a5fa' },
    { fill: '#f97316', text: '#fff7ed', glow: '#fb923c' },
    { fill: '#8b5cf6', text: '#f5f3ff', glow: '#a78bfa' },
    { fill: '#ec4899', text: '#fdf2f8', glow: '#f472b6' },
    { fill: '#ac1f89', text: '#edf340', glow: '#2dd4bf' },
    { fill: '#74faea', text: '#223531', glow: '#2dd4bf' },
    { fill: '#c9f33f', text: '#274e3c', glow: '#91fb54' },
    { fill: '#a988e1', text: '#0a3d31', glow: '#f85fdc' },
    { fill: '#e5d016', text: '#000000', glow: '#ecf935' },
    { fill: '#9d4c52', text: '#1b090c', glow: 'rgb(250, 95, 222)' },
    { fill: '#e0f896', text: '#000000', glow: '#ba3ffc' },
    { fill: '#fcfafb', text: '#0c0305', glow: '#fafafa' },
    { fill: '#e7b1f3', text: '#000000', glow: '#f2b6b6' },
    { fill: '#f6b3b9', text: '#000000', glow: '#f3adad' },
    { fill: '#8790f4', text: '#000000', glow: '#f7f3f3' },
    { fill: '#99e7f6', text: '#060606', glow: '#ffffff' },
    { fill: '#308375', text: '#060606', glow: '#fdfdfd' },
];
function tc(tier: number) {
    const t = TIER_COLORS[Math.min(tier, TIER_COLORS.length - 1)];
    return { color: t.fill, textColor: t.text, glow: t.glow };
}

const DUMMY_R = 20;

/** Create a TileDefExt with colours derived from tier. */
export function makeTile(id: string, char: string, meaning: string, tier: number): TileDefExt {
    return { id, char, meaning, tier, radius: DUMMY_R, ...tc(tier) };
}

export const TILES: Record<string, TileDefExt> = {
    //All tier 0 (tier + 1 strokes)
    hline: { id: 'hline', char: '一', meaning: 'one / horizontal stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    vline: { id: 'vline', char: '｜', meaning: 'vertical stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    rbend: { id: 'rbend', char: '⺄', meaning: 'bend right side', tier: 0, radius: DUMMY_R, ...tc(0) },
    cstroke: { id: 'cstroke', char: 'ノ', meaning: 'curved left stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    downstroke: { id: 'downstroke', char: '㇏', meaning: 'downward stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    dot: { id: 'dot', char: '丶', meaning: 'dot stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    hook: { id: 'hook', char: '亅', meaning: 'hook stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    bend: { id: 'bend', char: '乙', meaning: 'bend stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    benthook: { id: 'benthook', char: '乚', meaning: 'bent hook', tier: 0, radius: DUMMY_R, ...tc(0) },
    gun: { id: 'gun', char: '𠂉', meaning: 'gun stroke', tier: 0, radius: DUMMY_R, ...tc(0) },
    //not draggable

    //Tier 1

    
};

// ─── Merge recipes ────────────────────────────────────────────────────────────
export const MERGES: [string, string, string, string, string, number][] = [

];

// ─── Target pool ──────────────────────────────────────────────────────────────
export const TARGET_POOL: string[] = [
    'fu', 'divining', 'shand', 'craft', 'knife', 'power', 'direction', 'oldbird', 'again',
];
