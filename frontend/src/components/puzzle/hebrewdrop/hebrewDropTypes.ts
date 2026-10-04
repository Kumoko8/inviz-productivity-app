/**
 * hebrewDropTypes — runtime state and utilities for HebrewDrop.
 *
 * Grid model: 8 columns × 40 logical rows (scrollable, 9 visible at a time).
 * Recipes are ORDERED letter sequences (Hebrew right-to-left).
 * Merge detection scans horizontal runs in each row, checking both LTR and
 * RTL orderings, so the user can place letters in either direction.
 */

import { HEBREW_ALPHABET } from '../HebrewDropData';
import { makeTile } from '../KanjiDropData';
import type { TileDefExt } from '../KanjiDropData';

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLS = 8;
export const TOTAL_ROWS = 40;   // logical grid height
export const VISIBLE_ROWS = 9;  // rows shown in the canvas viewport
export const CELL = 48;
export const CANVAS_W = COLS * CELL;
export const CANVAS_H = VISIBLE_ROWS * CELL;

/** All 27 Hebrew letters are palette-droppable. */
export const HB_DROPPABLE_IDS: string[] = HEBREW_ALPHABET.map(l => l.id);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridCell { tileId: string; }

export interface GoalGroup { id: string; name: string; memberIds: string[]; open: boolean; }

export interface MergeAnim {
    type: 'absorbed' | 'pulse';
    x: number; y: number;
    color: string; textColor: string; glow: string; char: string;
    startTime: number; dur: number;
}

export interface DragState {
    tileId: string;
    cx: number; cy: number;
    source: 'palette' | { col: number; row: number };
}

export type GamePhase = 'charPick' | 'playing';

// ─── Runtime globals (mutated when vocab words are loaded/added) ──────────────

/** Starts with 27 Hebrew letters; vocab word tiles are registered at runtime. */
export const HB_RUNTIME_TILES: Record<string, TileDefExt> = {};
for (const letter of HEBREW_ALPHABET) {
    HB_RUNTIME_TILES[letter.id] = {
        id: letter.id,
        char: letter.char,
        meaning: letter.name,
        tier: 0,
        radius: 20,
        color: letter.color,
        textColor: letter.textColor,
        glow: letter.glow,
    };
}

/**
 * Maps an ordered letter-ID sequence to its merged result.
 * Key format: "letterId1,letterId2,...,letterIdN" (in Hebrew word order = RTL).
 * Merge detection checks both LTR and RTL orderings of each horizontal run.
 */
export const HB_RUNTIME_MERGE_MAP = new Map<string, { result: string; xp: number }>();

// Re-export for use in HebrewDrop callbacks
export { makeTile };

// ─── Utilities ────────────────────────────────────────────────────────────────

export function hbLookupTile(id: string): TileDefExt | undefined {
    return HB_RUNTIME_TILES[id];
}

export function emptyGrid(): (GridCell | null)[][] {
    return Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
}

/**
 * Scans every row of the logical grid for contiguous horizontal runs of tiles.
 * For each run, tries all sub-sequences of length 2–7 and checks both the
 * left-to-right and right-to-left orderings against HB_RUNTIME_MERGE_MAP.
 * Returns the first (bottom-most) match found so callers can loop until none.
 */
export function resolveOneHbPass(grid: (GridCell | null)[][]): {
    col: number; row: number;
    resultId: string; xp: number;
    absorbedCells: [number, number][];
} | null {
    for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
        // Collect contiguous horizontal runs in this row
        const runs: Array<{ col: number; tileId: string }[]> = [];
        let cur: { col: number; tileId: string }[] = [];
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (cell) {
                cur.push({ col: c, tileId: cell.tileId });
            } else {
                if (cur.length >= 2) runs.push(cur);
                cur = [];
            }
        }
        if (cur.length >= 2) runs.push(cur);

        for (const run of runs) {
            const maxLen = Math.min(7, run.length);
            for (let len = maxLen; len >= 2; len--) {
                for (let start = 0; start <= run.length - len; start++) {
                    const sub = run.slice(start, start + len);
                    const ids = sub.map(x => x.tileId);
                    const ltrKey = ids.join(',');
                    const rtlKey = [...ids].reverse().join(',');
                    const match = HB_RUNTIME_MERGE_MAP.get(ltrKey) ?? HB_RUNTIME_MERGE_MAP.get(rtlKey);
                    if (match) {
                        // Result tile goes in the leftmost cell of the matched sub-run;
                        // remaining cells are absorbed.
                        const absorbedCells: [number, number][] = sub.slice(1).map(
                            x => [x.col, r] as [number, number]
                        );
                        return {
                            col: sub[0].col, row: r,
                            resultId: match.result, xp: match.xp,
                            absorbedCells,
                        };
                    }
                }
            }
        }
    }
    return null;
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────

export function drawHbTile(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    tileId: string,
    alpha = 1,
    scale = 1,
) {
    const def = hbLookupTile(tileId);
    if (!def) return;
    const s = (CELL * 0.88) * scale;
    const r = s * 0.38;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Fake glow
    const glowSize = s + 10 * scale;
    const glowR = glowSize * 0.38;
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = def.glow;
    ctx.beginPath();
    ctx.roundRect(cx - glowSize / 2, cy - glowSize / 2, glowSize, glowSize, glowR);
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Fill
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();

    // Highlight gradient
    const grad = ctx.createRadialGradient(cx - s * 0.18, cy - s * 0.18, 0, cx, cy, s * 0.6);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2, cy - s / 2, s, s, r);
    ctx.fill();

    // Border
    ctx.strokeStyle = def.glow + 'bb';
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath();
    ctx.roundRect(cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2, r);
    ctx.stroke();

    // Text — scale font down for multi-character vocab tiles
    const charLen = def.char.length;
    const fontSize = charLen <= 1
        ? Math.round(s * 0.50)
        : charLen <= 3
            ? Math.round(s * 0.34)
            : charLen <= 5
                ? Math.round(s * 0.26)
                : Math.round(s * 0.20);
    ctx.fillStyle = def.textColor;
    ctx.font = `bold ${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.char, cx, cy + 1);

    ctx.restore();
}
