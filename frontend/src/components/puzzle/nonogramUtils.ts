export type CellState = 'empty' | 'filled' | 'marked'; // marked = ✕ known-empty

export interface NonogramPuzzle {
    size: number;
    rowClues: number[][];
    colClues: number[][];
}

// Fast xorshift32 seeded PRNG — deterministic puzzle per (date + size + offset)
function seededRandom(seed: number): () => number {
    let s = (seed ^ 0xdeadbeef) >>> 0;
    return () => {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return (s >>> 0) / 0xffffffff;
    };
}

export function computeClues(line: boolean[]): number[] {
    const clues: number[] = [];
    let count = 0;
    for (const cell of line) {
        if (cell) {
            count++;
        } else if (count > 0) {
            clues.push(count);
            count = 0;
        }
    }
    if (count > 0) clues.push(count);
    return clues.length > 0 ? clues : [0];
}

/**
 * Generates today's nonogram for a given size.
 * Pass a `seedOffset` (e.g. 1, 2 …) to get additional daily puzzles ("Play Again").
 */
export function generateNonogram(size: number, seedOffset = 0): NonogramPuzzle {
    const today = new Date();
    const dateSeed =
        today.getFullYear() * 10000 +
        (today.getMonth() + 1) * 100 +
        today.getDate();
    const seed = dateSeed * 10000 + size * 100 + seedOffset;
    const rng = seededRandom(seed);

    // ~50% fill density — looks good across all sizes
    const solution: boolean[][] = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => rng() > 0.42)
    );

    const rowClues = solution.map(row => computeClues(row));
    const colClues = Array.from({ length: size }, (_, c) =>
        computeClues(solution.map(row => row[c]))
    );

    return { size, rowClues, colClues };
}

/** Per-row and per-column completion status for live highlighting. */
export function getClueStatus(
    userGrid: CellState[][],
    rowClues: number[][],
    colClues: number[][]
): { rows: boolean[]; cols: boolean[] } {
    const size = userGrid.length;
    const rows = rowClues.map((clue, r) => {
        const line = userGrid[r].map(c => c === 'filled');
        return JSON.stringify(computeClues(line)) === JSON.stringify(clue);
    });
    const cols = colClues.map((clue, c) => {
        const line = userGrid.map(row => row[c] === 'filled');
        return JSON.stringify(computeClues(line)) === JSON.stringify(clue);
    });
    return { rows, cols };
}

/** Returns true when all row and column clues are satisfied. */
export function checkSolved(
    userGrid: CellState[][],
    rowClues: number[][],
    colClues: number[][]
): boolean {
    const { rows, cols } = getClueStatus(userGrid, rowClues, colClues);
    return rows.every(Boolean) && cols.every(Boolean);
}

/**
 * XP formula:
 *  - No goal set       → flat baseXP
 *  - ratio = |elapsed - goal| / goal
 *  - ratio >= 0.5      → 0 XP
 *  - ratio < 0.5       → baseXP * (1 – ratio / 0.5)  [linear scale]
 */
export function computePuzzleXP(
    elapsedSeconds: number,
    goalSeconds: number | null,
    level: 1 | 2 | 3
): number {
    const baseXP: Record<1 | 2 | 3, number> = { 1: 50, 2: 150, 3: 400 };
    const base = baseXP[level];
    if (!goalSeconds || goalSeconds <= 0) return base;
    const ratio = Math.abs(elapsedSeconds - goalSeconds) / goalSeconds;
    if (ratio >= 0.5) return 0;
    return Math.round(base * (1 - ratio / 0.5));
}

export function formatTime(totalSeconds: number): string {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function makeEmptyGrid(size: number): CellState[][] {
    return Array.from({ length: size }, () =>
        Array<CellState>(size).fill('empty')
    );
}
