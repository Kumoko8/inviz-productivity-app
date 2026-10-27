// ─── Pixel art ────────────────────────────────────────────────────────────────
export const GRID = 16;
export const TRANSPARENT = '.';

// Pixels are stored as a GRID*GRID string; each char is a base-36 index into PALETTE ('.' = transparent).
export const PALETTE = [
    '#000000', '#3a3a4a', '#7f7f8f', '#ffffff',
    '#7f1d1d', '#dc2626', '#f87171', '#fecaca',
    '#9a3412', '#f97316', '#fdba74', '#fed7aa',
    '#854d0e', '#eab308', '#fde047', '#fef9c3',
    '#14532d', '#16a34a', '#4ade80', '#bbf7d0',
    '#115e59', '#14b8a6', '#5eead4', '#a5f3fc',
    '#1e3a8a', '#2563eb', '#60a5fa', '#bfdbfe',
    '#581c87', '#9333ea', '#c084fc', '#f9a8d4',
    '#78350f', '#a16207', '#d4a373', '#fcd5b0',
];

export const EMPTY_PIXELS = TRANSPARENT.repeat(GRID * GRID);

// ─── Data model ───────────────────────────────────────────────────────────────
export interface BubbleTile {
    id: string;
    name: string;
    pixels: string;
    spawnable: boolean;
    groupId?: string;
}

export interface BubbleGroup {
    id: string;
    name: string;
}

export interface TileSection {
    id: string;
    name: string;
    tiles: BubbleTile[];
}

/** Splits tiles into one section per group (in group order) plus a trailing "Ungrouped" section. */
export function sectionTiles(tiles: BubbleTile[], groups: BubbleGroup[]): TileSection[] {
    const known = new Set(groups.map(g => g.id));
    const sections: TileSection[] = groups.map(g => ({ id: g.id, name: g.name, tiles: tiles.filter(t => t.groupId === g.id) }));
    const loose = tiles.filter(t => !t.groupId || !known.has(t.groupId));
    if (loose.length) sections.push({ id: '', name: groups.length ? 'Ungrouped' : 'Tiles', tiles: loose });
    return sections.filter(s => s.tiles.length > 0);
}

export interface BubbleRecipe {
    id: string;
    a: string;
    ingredients: string[];
    result: string;
    xp: number;
}

export interface BubbleData {
    tiles: BubbleTile[];
    recipes: BubbleRecipe[];
    groups: BubbleGroup[];
}

export type BubbleGrid = (string | null)[][];

// ─── Board ────────────────────────────────────────────────────────────────────
export const COLS = 10;
export const ROWS = 8;
export const CELL = 56;
export const CANVAS_W = COLS * CELL;
export const CANVAS_H = ROWS * CELL;

export function newId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyGrid(): BubbleGrid {
    return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

// ─── Merge logic ──────────────────────────────────────────────────────────────
export type RecipeMap = Map<string, { result: string; xp: number }>;

export function recipeKey(a: string, ingredients: string[]): string {
    return `${a}|${[...ingredients].sort().join(',')}`;
}

export function buildRecipeMap(recipes: BubbleRecipe[]): RecipeMap {
    const map: RecipeMap = new Map();
    for (const r of recipes) map.set(recipeKey(r.a, r.ingredients), { result: r.result, xp: r.xp });
    return map;
}

interface Neighbor { col: number; row: number; tileId: string; }

function neighbors(col: number, row: number): [number, number][] {
    return ([[col, row - 1], [col, row + 1], [col - 1, row], [col + 1, row]] as [number, number][])
        .filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
}

function combinations<T>(arr: T[], size: number): T[][] {
    if (size === 1) return arr.map(x => [x]);
    return arr.flatMap((x, i) => combinations(arr.slice(i + 1), size - 1).map(rest => [x, ...rest]));
}

interface Merge { result: string; xp: number; absorbed: [number, number][]; }

function findMerge(map: RecipeMap, placed: string, avail: Neighbor[]): Merge | null {
    for (let size = Math.min(3, avail.length); size >= 2; size--) {
        for (const combo of combinations(avail, size)) {
            const hit = map.get(recipeKey(placed, combo.map(n => n.tileId)));
            if (hit) return { ...hit, absorbed: combo.map(n => [n.col, n.row] as [number, number]) };
        }
    }
    // Single-ingredient recipes absorb every adjacent copy of that tile.
    let best: Merge | null = null;
    const tried = new Set<string>();
    for (const n of avail) {
        if (tried.has(n.tileId)) continue;
        tried.add(n.tileId);
        const hit = map.get(recipeKey(placed, [n.tileId]));
        if (!hit) continue;
        const absorbed = avail.filter(nb => nb.tileId === n.tileId).map(nb => [nb.col, nb.row] as [number, number]);
        if (!best || absorbed.length > best.absorbed.length) best = { ...hit, absorbed };
    }
    return best;
}

export interface MergeStep {
    col: number;
    row: number;
    absorbed: [number, number][];
    result: string;
    xp: number;
    before: BubbleGrid;
    after: BubbleGrid;
}

export interface ResolveOutcome {
    grid: BubbleGrid;
    xp: number;
    results: string[];
    steps: MergeStep[];
}

/** Repeatedly applies recipes until the board is stable. */
export function resolveBoard(start: BubbleGrid, map: RecipeMap): ResolveOutcome {
    const grid = start.map(row => [...row]);
    let xp = 0;
    const results: string[] = [];
    const steps: MergeStep[] = [];
    for (let guard = 0; guard < 200; guard++) {
        let applied = false;
        outer:
        for (let r = ROWS - 1; r >= 0; r--) {
            for (let c = 0; c < COLS; c++) {
                const id = grid[r][c];
                if (!id) continue;
                const avail: Neighbor[] = neighbors(c, r)
                    .filter(([nc, nr]) => grid[nr][nc] !== null)
                    .map(([nc, nr]) => ({ col: nc, row: nr, tileId: grid[nr][nc]! }));
                const merge = findMerge(map, id, avail);
                if (!merge) continue;
                const before = grid.map(row => [...row]);
                for (const [ac, ar] of merge.absorbed) grid[ar][ac] = null;
                grid[r][c] = merge.result;
                steps.push({
                    col: c, row: r, absorbed: merge.absorbed, result: merge.result, xp: merge.xp,
                    before, after: grid.map(row => [...row]),
                });
                xp += merge.xp;
                results.push(merge.result);
                applied = true;
                break outer;
            }
        }
        if (!applied) break;
    }
    return { grid, xp, results, steps };
}

// ─── Rendering ────────────────────────────────────────────────────────────────
const spriteCache = new Map<string, HTMLCanvasElement>();

export function getSprite(pixels: string): HTMLCanvasElement {
    let sprite = spriteCache.get(pixels);
    if (sprite) return sprite;
    sprite = document.createElement('canvas');
    sprite.width = GRID;
    sprite.height = GRID;
    const ctx = sprite.getContext('2d')!;
    for (let i = 0; i < pixels.length && i < GRID * GRID; i++) {
        const idx = parseInt(pixels[i], 36);
        if (pixels[i] === TRANSPARENT || Number.isNaN(idx) || !PALETTE[idx]) continue;
        ctx.fillStyle = PALETTE[idx];
        ctx.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
    }
    spriteCache.set(pixels, sprite);
    return sprite;
}

export function drawBubble(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, size: number,
    pixels: string, alpha = 1,
) {
    const r = size / 2;
    ctx.save();
    ctx.globalAlpha = alpha;

    const fill = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    fill.addColorStop(0, 'rgba(255,255,255,0.28)');
    fill.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const rainbow = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'].forEach((c, i, a) =>
        rainbow.addColorStop(i / (a.length - 1), c));
    ctx.strokeStyle = rainbow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.imageSmoothingEnabled = false;
    const inner = Math.floor((size * 0.68) / GRID) * GRID || GRID;
    ctx.drawImage(getSprite(pixels), Math.round(cx - inner / 2), Math.round(cy - inner / 2), inner, inner);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.45, cy - r * 0.55, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
