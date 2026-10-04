import { TILES, MERGES, makeTile } from '../KanjiDropData';
import type { TileDefExt } from '../KanjiDropData';

// ─── Constants ────────────────────────────────────────────────────────────────
export const DROPPABLE_IDS = ['dot', 'hline', 'vline', 'cstroke', 'bend', 'benthook','downstroke', 'hook', 'gun','rbend',];

export const COLS = 7;
export const ROWS = 9;
export const CELL = 48;
export const CANVAS_W = COLS * CELL;
export const CANVAS_H = ROWS * CELL;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GridCell { tileId: string; }

export interface GoalGroup { id: string; name: string; memberIds: string[]; open: boolean; }

export interface MergeAnim {
    type: 'absorbed' | 'pulse';
    x: number; y: number;
    color: string; textColor: string; glow: string; char: string;
    startTime: number;
    dur: number;
}

export interface DragState {
    tileId: string;
    cx: number; cy: number;
    source: 'palette' | { col: number; row: number };
}

export interface NeighborCell { col: number; row: number; tileId: string; }

export type GamePhase = 'charPick' | 'playing';

// ─── Runtime globals (mutable — mutated when custom kanjis are added) ─────────
export const RUNTIME_TILES: Record<string, TileDefExt> = { ...TILES };

export const RUNTIME_MERGE_MAP = new Map<string, { result: string; xp: number }>();
for (const [a, b, c, d, result, xp] of MERGES) {
    const required = [b, c, d].filter(x => x !== '').sort();
    RUNTIME_MERGE_MAP.set(`${a}|${required.join(',')}`, { result, xp });
}

// Re-export for consumers that need to register new tiles/recipes at runtime
export { makeTile };

// ─── Utilities ────────────────────────────────────────────────────────────────
export function lookupTile(id: string): TileDefExt | undefined {
    return RUNTIME_TILES[id];
}

export function getCombinations<T>(arr: T[], size: number): T[][] {
    if (size === 1) return arr.map(x => [x]);
    return arr.flatMap((x, i) =>
        getCombinations(arr.slice(i + 1), size - 1).map(rest => [x, ...rest])
    );
}

export function findBestMerge(
    placed: string,
    avail: NeighborCell[],
): { result: string; xp: number; absorbedCells: [number, number][] } | null {
    for (let size = Math.min(3, avail.length); size >= 2; size--) {
        for (const combo of getCombinations(avail, size)) {
            const ids = combo.map(n => n.tileId).sort();
            const recipe = RUNTIME_MERGE_MAP.get(`${placed}|${ids.join(',')}`);
            if (!recipe) continue;
            return { ...recipe, absorbedCells: combo.map(n => [n.col, n.row] as [number, number]) };
        }
    }
    let best: { result: string; xp: number; absorbedCells: [number, number][] } | null = null;
    const tried = new Set<string>();
    for (const n of avail) {
        if (tried.has(n.tileId)) continue;
        tried.add(n.tileId);
        const recipe = RUNTIME_MERGE_MAP.get(`${placed}|${n.tileId}`);
        if (!recipe) continue;
        const absorbedCells: [number, number][] = avail
            .filter(nb => nb.tileId === n.tileId)
            .map(nb => [nb.col, nb.row]);
        if (!best || absorbedCells.length > best.absorbedCells.length) {
            best = { ...recipe, absorbedCells };
        }
    }
    return best;
}

export function neighbors(col: number, row: number): [number, number][] {
    return ([
        [col, row - 1], [col, row + 1], [col - 1, row], [col + 1, row],
    ] as [number, number][]).filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);
}

export function emptyGrid(): (GridCell | null)[][] {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function resolveOnePass(grid: (GridCell | null)[][]): {
    col: number; row: number;
    resultId: string; xp: number;
    absorbedCells: [number, number][];
} | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (!cell) continue;
            const avail: NeighborCell[] = neighbors(c, r)
                .filter(([nc, nr]) => grid[nr][nc] !== null)
                .map(([nc, nr]) => ({ col: nc, row: nr, tileId: grid[nr][nc]!.tileId }));
            const merge = findBestMerge(cell.tileId, avail);
            if (merge) return { col: c, row: r, resultId: merge.result, xp: merge.xp, absorbedCells: merge.absorbedCells };
        }
    }
    return null;
}

// Cache radial gradients per tile+scale key so they're not recreated every frame.
const _gradCache = new Map<string, CanvasGradient>();

export function drawGooeyTile(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    tileId: string,
    alpha = 1,
    scale = 1,
) {
    const def = lookupTile(tileId);
    if (!def) return;
    const s = (CELL * 0.88) * scale;
    const r = s * 0.38;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Fake glow: draw a slightly-larger transparent rect behind the tile.
    // Much cheaper than ctx.shadowBlur which triggers a full software blur pass.
    const glowSize = s + 10 * scale;
    const glowR = glowSize * 0.38;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = def.glow;
    ctx.beginPath();
    ctx.roundRect(cx - glowSize / 2, cy - glowSize / 2, glowSize, glowSize, glowR);
    ctx.fill();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();

    // Radial gradient highlight — cached per tileId+scale to avoid recreation every frame.
    const gradKey = `${tileId}|${scale}`;
    let grad = _gradCache.get(gradKey);
    if (!grad) {
        grad = ctx.createRadialGradient(cx - s * 0.18, cy - s * 0.18, 0, cx, cy, s * 0.6);
        grad.addColorStop(0, 'rgba(255,255,255,0.30)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        _gradCache.set(gradKey, grad);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();

    ctx.strokeStyle = def.glow + 'bb';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, r);
    ctx.stroke();

    ctx.fillStyle = def.textColor;
    const fontSize = Math.round(s * 0.44);
    ctx.font = `bold ${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.char, cx, cy + 1);
    ctx.restore();
}
