import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PuzzleCharacterOption } from './PuzzleMode';
import { xpThreshold } from '../../utils/xpUtils';

// ─── Types ────────────────────────────────────────────────────────────────────

type SudokuSize = 3 | 4 | 6 | 9;
type L3Difficulty = 'simple' | 'complex' | 'challenging';

export interface SudokuGameProps {
    onClose: () => void;
    allCharacters?: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, xp: number) => void;
}

// ─── Puzzle Generator ─────────────────────────────────────────────────────────

/** Fisher-Yates shuffle with a seeded LCG so results are reproducible. */
function shuffle<T>(arr: T[], seed: number): T[] {
    const a = [...arr];
    let s = Math.abs(seed) % 2147483647 || 1;
    const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Backtracking solver — fills `board` in-place. Returns true if solved. */
function solve(board: number[][], size: number, boxes: [number, number][]): boolean {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] !== 0) continue;
            for (let v = 1; v <= size; v++) {
                if (isValid(board, r, c, v, size, boxes)) {
                    board[r][c] = v;
                    if (solve(board, size, boxes)) return true;
                    board[r][c] = 0;
                }
            }
            return false;
        }
    }
    return true;
}

/** Box layout for each supported size. Returns [boxRows, boxCols]. */
function boxDims(size: SudokuSize): [number, number] {
    if (size === 3) return [1, 3]; // 3×3: one 1×3 strip (special — full rows are boxes)
    if (size === 4) return [2, 2];
    if (size === 6) return [2, 3];
    return [3, 3]; // 9
}

/** List of [boxRow, boxCol] groups for a given size. */
function buildBoxes(size: SudokuSize): [number, number][] {
    const [br, bc] = boxDims(size);
    const boxes: [number, number][] = [];
    for (let r = 0; r < size; r += br)
        for (let c = 0; c < size; c += bc)
            boxes.push([r, c]);
    return boxes;
}

function boxOf(row: number, col: number, size: SudokuSize): number {
    const [br, bc] = boxDims(size);
    return Math.floor(row / br) * (size / bc) + Math.floor(col / bc);
}

function isValid(board: number[][], row: number, col: number, val: number, size: number, boxes: [number, number][]): boolean {
    for (let i = 0; i < size; i++) {
        if (board[row][i] === val) return false;
        if (board[i][col] === val) return false;
    }
    const [br, bc] = boxDims(size as SudokuSize);
    const br0 = Math.floor(row / br) * br;
    const bc0 = Math.floor(col / bc) * bc;
    for (let r = br0; r < br0 + br; r++)
        for (let c = bc0; c < bc0 + bc; c++)
            if (board[r][c] === val) return false;
    return true;
}

/** Generate a complete valid board for the given size. */
function generateFull(size: SudokuSize, seed: number): number[][] {
    const boxes = buildBoxes(size);
    const board: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    // Seed the first row and use backtracking to fill the rest
    const firstRow = shuffle(Array.from({ length: size }, (_, i) => i + 1), seed);
    board[0] = firstRow;
    solve(board, size, boxes);
    return board;
}

/** Remove cells to create a puzzle. Returns the puzzle (0 = empty) and the solution. */
function digHoles(full: number[][], size: SudokuSize, clues: number, seed: number): { puzzle: number[][], solution: number[][] } {
    const solution = full.map(r => [...r]);
    const puzzle = full.map(r => [...r]);
    const positions = shuffle(
        Array.from({ length: size * size }, (_, i) => [Math.floor(i / size), i % size] as [number, number]),
        seed + 1
    );
    let removed = 0;
    const target = size * size - clues;
    for (const [r, c] of positions) {
        if (removed >= target) break;
        puzzle[r][c] = 0;
        removed++;
    }
    return { puzzle, solution };
}

const CLUE_COUNTS: Record<SudokuSize, Record<string, number>> = {
    3: { default: 5 },          // 3×3 has 9 cells; leave ~5 given
    4: { default: 10 },         // 4×4 has 16 cells; leave ~10 given
    6: { default: 18 },         // 6×6 has 36 cells; leave ~18 given
    9: { simple: 40, complex: 30, challenging: 22 }, // 9×9 standard
};

function buildPuzzle(size: SudokuSize, seed: number, difficulty: L3Difficulty = 'simple') {
    const full = generateFull(size, seed);
    const clueKey = size === 9 ? difficulty : 'default';
    const clues = CLUE_COUNTS[size][clueKey];
    return digHoles(full, size, clues, seed);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Level = 1 | 2 | 3;
type L2Size = 4 | 6;
type Phase = 'charPick' | 'levelSelect' | 'l2SizeSelect' | 'l3DiffSelect' | 'playing' | 'complete';

const SIZE_LABELS: Record<SudokuSize, string> = { 3: '3×3', 4: '4×4', 6: '6×6', 9: '9×9' };

function bestKey(charId: string, size: SudokuSize, diff: L3Difficulty) {
    return `sudoku.best.${charId}.${size}.${diff}`;
}
function loadBest(charId: string, size: SudokuSize, diff: L3Difficulty): number | null {
    try { const v = localStorage.getItem(bestKey(charId, size, diff)); return v ? parseInt(v, 10) : null; } catch { return null; }
}
function saveBest(charId: string, size: SudokuSize, diff: L3Difficulty, t: number) {
    try { localStorage.setItem(bestKey(charId, size, diff), String(t)); } catch {}
}

const SudokuGame: React.FC<SudokuGameProps> = ({ onClose, allCharacters = [], onAwardXP }) => {
    const [phase, setPhase] = useState<Phase>('charPick');
    const [sudokuSize, setSudokuSize] = useState<SudokuSize>(3);
    const [difficulty, setDifficulty] = useState<L3Difficulty>('simple');
    const [seed, setSeed] = useState(() => Math.floor(Math.random() * 999983));
    const [selectedChar, setSelectedChar] = useState<PuzzleCharacterOption | null>(null);
    const [charSearch, setCharSearch] = useState('');

    const [puzzle, setPuzzle] = useState<number[][] | null>(null);
    const [solution, setSolution] = useState<number[][] | null>(null);
    const [userGrid, setUserGrid] = useState<number[][] | null>(null);
    const [selected, setSelected] = useState<[number, number] | null>(null);
    const [errors, setErrors] = useState<Set<string>>(new Set());
    const [solved, setSolved] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [xpEarned, setXpEarned] = useState(0);
    const [isNewBest, setIsNewBest] = useState(false);
    const timerRef = useRef<number | null>(null);
    const elapsedRef = useRef(0);
    const sudokuSizeRef = useRef<SudokuSize>(3);
    const difficultyRef = useRef<L3Difficulty>('simple');

    // Keep refs in sync so the solved-effect can read current game config
    useEffect(() => { sudokuSizeRef.current = sudokuSize; }, [sudokuSize]);
    useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);

    // Award XP when puzzle is solved
    useEffect(() => {
        if (!solved) return;
        const finalTime = elapsedRef.current;
        const size = sudokuSizeRef.current;
        const diff = difficultyRef.current;
        if (!selectedChar || selectedChar.id === '__guest__') return;
        const prev = loadBest(selectedChar.id, size, diff);
        const gotNewBest = prev === null || finalTime < prev;
        if (gotNewBest) saveBest(selectedChar.id, size, diff, finalTime);
        setIsNewBest(gotNewBest);
        const xp = (prev !== null && prev > finalTime) ? (prev - finalTime) * 4 : 0;
        setXpEarned(xp);
        if (xp > 0) onAwardXP?.(selectedChar.id, xp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [solved]);

    // ── Timer ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'playing' && !solved) {
            timerRef.current = window.setInterval(() => {
                elapsedRef.current++;
                setElapsed(elapsedRef.current);
            }, 1000);
        } else {
            if (timerRef.current) window.clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
    }, [phase, solved]);

    // ── Start game ─────────────────────────────────────────────────────
    const startGame = useCallback((size: SudokuSize, diff: L3Difficulty) => {
        const { puzzle: p, solution: s } = buildPuzzle(size, seed, diff);
        setPuzzle(p);
        setSolution(s);
        setUserGrid(p.map(r => [...r]));
        setSelected(null);
        setErrors(new Set());
        setSolved(false);
        setXpEarned(0);
        setIsNewBest(false);
        elapsedRef.current = 0;
        setElapsed(0);
        setSudokuSize(size);
        setDifficulty(diff);
        setPhase('playing');
    }, [seed]);

    // ── Cell input ─────────────────────────────────────────────────────
    const handleInput = useCallback((val: number) => {
        if (!userGrid || !puzzle || !solution || !selected) return;
        const [r, c] = selected;
        if (puzzle[r][c] !== 0) return; // given cell
        const newGrid = userGrid.map(row => [...row]);
        newGrid[r][c] = val;
        setUserGrid(newGrid);

        // validate
        const newErrors = new Set<string>();
        for (let row = 0; row < sudokuSize; row++) {
            for (let col = 0; col < sudokuSize; col++) {
                const v = newGrid[row][col];
                if (v !== 0 && v !== solution[row][col]) newErrors.add(`${row}-${col}`);
            }
        }
        setErrors(newErrors);

        // check complete (no errors, no blanks)
        const complete = newGrid.every((row, ri) => row.every((v, ci) => v !== 0 && v === solution[ri][ci]));
        if (complete) setSolved(true);
    }, [userGrid, puzzle, solution, selected, sudokuSize]);

    // ── Keyboard ───────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== 'playing') return;
        const handler = (e: KeyboardEvent) => {
            const n = parseInt(e.key);
            if (!isNaN(n) && n >= 1 && n <= sudokuSize) { handleInput(n); return; }
            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { handleInput(0); return; }
            if (!selected) return;
            let [r, c] = selected;
            if (e.key === 'ArrowUp')    r = Math.max(0, r - 1);
            if (e.key === 'ArrowDown')  r = Math.min(sudokuSize - 1, r + 1);
            if (e.key === 'ArrowLeft')  c = Math.max(0, c - 1);
            if (e.key === 'ArrowRight') c = Math.min(sudokuSize - 1, c + 1);
            setSelected([r, c]);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [phase, selected, sudokuSize, handleInput]);

    // ── Formatting ─────────────────────────────────────────────────────
    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

    // ── Box border helper ──────────────────────────────────────────────
    const boxBorderClass = (row: number, col: number): string => {
        const [br, bc] = boxDims(sudokuSize);
        const classes: string[] = [];
        if (row % br === 0 && row !== 0) classes.push('border-t-2 border-t-white/40');
        if (col % bc === 0 && col !== 0) classes.push('border-l-2 border-l-white/40');
        return classes.join(' ');
    };

    // ── Number pad ────────────────────────────────────────────────────
    const numPad = useMemo(() => Array.from({ length: sudokuSize }, (_, i) => i + 1), [sudokuSize]);

    // ─── Phase: charPick ───────────────────────────────────────────────
    if (phase === 'charPick') {
        const filtered = allCharacters.filter(c => c.name.toLowerCase().includes(charSearch.toLowerCase()));
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <div className="text-5xl mb-4">🔢</div>
                <div className="text-white font-extrabold text-xl tracking-widest mb-1">SUDOKU</div>
                <p className="text-gray-400 text-sm mb-5">Choose a character to play as</p>
                <div className="relative w-80 mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search…"
                        value={charSearch}
                        onChange={e => setCharSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div className="overflow-y-auto max-h-64 w-80 space-y-1.5 pr-1">
                    {filtered.map(c => (
                        <button
                            key={c.id}
                            onClick={() => { setSelectedChar(c); setPhase('levelSelect'); }}
                            className="w-full text-left px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-900 hover:border-indigo-500 hover:bg-indigo-900/20 text-gray-300 transition-all text-sm font-medium"
                        >
                            {c.name}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <p className="text-gray-600 text-sm italic text-center py-4">No characters found</p>
                    )}
                </div>
                <button
                    onClick={() => { setSelectedChar(null); setPhase('levelSelect'); }}
                    className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline"
                >
                    Play without a character
                </button>
            </div>
        );
    }

    // ─── Phase: levelSelect ────────────────────────────────────────────
    if (phase === 'levelSelect') {
        const levels: { lvl: Level; label: string; desc: string }[] = [
            { lvl: 1, label: 'Level 1 — 3×3', desc: 'Single box · Perfect for beginners' },
            { lvl: 2, label: 'Level 2 — 4×4 or 6×6', desc: 'Pick your board size' },
            { lvl: 3, label: 'Level 3 — 9×9', desc: 'Classic sudoku · Choose difficulty' },
        ];
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('charPick')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-4">🔢</div>
                <h1 className="text-3xl font-bold text-white mb-2">Sudoku</h1>
                {selectedChar && <p className="text-indigo-400 text-xs mb-1">{selectedChar.name}</p>}
                <p className="text-gray-400 text-sm mb-8">Fill every row, column, and box with each number exactly once</p>
                <div className="flex flex-col gap-4 w-72">
                    {levels.map(({ lvl, label, desc }) => (
                        <button
                            key={lvl}
                            onClick={() => {
                                if (lvl === 1) startGame(3, 'simple');
                                else if (lvl === 2) setPhase('l2SizeSelect');
                                else setPhase('l3DiffSelect');
                            }}
                            className="py-5 px-6 rounded-2xl border-2 border-indigo-700 bg-gray-900 hover:bg-indigo-900/30 hover:border-indigo-400 transition-all text-left group"
                        >
                            <div className="text-base font-bold text-white group-hover:text-indigo-300">{label}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{desc}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ─── Phase: l2SizeSelect ───────────────────────────────────────────
    if (phase === 'l2SizeSelect') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('levelSelect')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-4">🔢</div>
                <h2 className="text-2xl font-bold text-white mb-2">Choose Board Size</h2>
                <div className="flex flex-col gap-4 w-64 mt-4">
                    {([4, 6] as L2Size[]).map(sz => (
                        <button
                            key={sz}
                            onClick={() => startGame(sz, 'simple')}
                            className="py-5 px-6 rounded-2xl border-2 border-indigo-700 bg-gray-900 hover:bg-indigo-900/30 hover:border-indigo-400 transition-all text-left group"
                        >
                            <div className="text-2xl font-bold text-white group-hover:text-indigo-300">{SIZE_LABELS[sz]}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{sz === 4 ? '16 cells · Easier' : '36 cells · More challenge'}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ─── Phase: l3DiffSelect ───────────────────────────────────────────
    if (phase === 'l3DiffSelect') {
        const diffs: { d: L3Difficulty; label: string; desc: string }[] = [
            { d: 'simple',      label: 'Simple',      desc: '~40 given clues' },
            { d: 'complex',     label: 'Complex',     desc: '~30 given clues' },
            { d: 'challenging', label: 'Challenging', desc: '~22 given clues' },
        ];
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <button onClick={() => setPhase('levelSelect')} className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm">← Back</button>
                <div className="text-5xl mb-4">🔢</div>
                <h2 className="text-2xl font-bold text-white mb-2">Choose Difficulty</h2>
                <p className="text-gray-400 text-sm mb-6">9×9 Classic Sudoku</p>
                <div className="flex flex-col gap-4 w-64">
                    {diffs.map(({ d, label, desc }) => (
                        <button
                            key={d}
                            onClick={() => startGame(9, d)}
                            className="py-5 px-6 rounded-2xl border-2 border-indigo-700 bg-gray-900 hover:bg-indigo-900/30 hover:border-indigo-400 transition-all text-left group"
                        >
                            <div className="text-lg font-bold text-white group-hover:text-indigo-300">{label}</div>
                            <div className="text-sm text-gray-500 mt-0.5">{desc}</div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // ─── Phase: complete ──────────────────────────────────────────────
    if (phase === 'complete' || (phase === 'playing' && solved)) {
        const prevBestDisplay = selectedChar && selectedChar.id !== '__guest__'
            ? loadBest(selectedChar.id, sudokuSize, difficulty)
            : null;
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-white mb-2">Solved!</h2>
                <p className="text-gray-400 text-sm mb-1">{SIZE_LABELS[sudokuSize]} · {sudokuSize === 9 ? difficulty : 'standard'}</p>
                {selectedChar && selectedChar.id !== '__guest__' && (
                    <p className="text-indigo-400 text-xs mb-1">{selectedChar.name}</p>
                )}
                <p className="text-indigo-300 text-lg font-mono mb-3">{fmt(elapsed)}</p>
                {isNewBest && (
                    <p className="text-yellow-300 text-sm font-bold mb-1">🏆 New Best!</p>
                )}
                {prevBestDisplay !== null && !isNewBest && (
                    <p className="text-gray-500 text-xs mb-1">Best: {fmt(prevBestDisplay)}</p>
                )}
                {xpEarned > 0 && (
                    <div className="bg-white border border-amber-400 rounded-lg shadow px-4 py-2.5 mb-4 w-44">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-amber-600">+{xpEarned} XP</span>
                            {selectedChar && <span className="text-xs text-gray-400">{selectedChar.name}</span>}
                        </div>
                        <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                            <div
                                className="h-2 bg-amber-400 rounded transition-all duration-700"
                                style={{ width: `${Math.min(100, Math.round(((selectedChar?.xp ?? 0) + xpEarned) % Math.max(1, xpThreshold(selectedChar?.level ?? 1)) / Math.max(1, xpThreshold(selectedChar?.level ?? 1)) * 100))}%` }}
                            />
                        </div>
                    </div>
                )}
                {xpEarned === 0 && selectedChar && selectedChar.id !== '__guest__' && (
                    <p className="text-gray-600 text-xs mb-4">{prevBestDisplay === null ? 'First solve! Beat this time for XP.' : 'Beat your best time to earn XP'}</p>
                )}
                <div className="mt-2 flex gap-3">
                    <button
                        onClick={() => { setSeed(s => s + 1); setPhase('levelSelect'); }}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-colors"
                    >
                        Play Again
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-semibold transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    // ─── Phase: playing ───────────────────────────────────────────────
    if (phase !== 'playing' || !userGrid || !puzzle || !solution) return null;

    const selR = selected?.[0] ?? -1;
    const selC = selected?.[1] ?? -1;
    const selVal = selected ? userGrid[selR][selC] : 0;
    const selBox = selected ? boxOf(selR, selC, sudokuSize) : -1;

    // Cell size responsive to board
    const cellSizeCls = sudokuSize <= 4 ? 'w-14 h-14 text-2xl' : sudokuSize === 6 ? 'w-11 h-11 text-xl' : 'w-9 h-9 text-base';

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-4 select-none">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>

            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-gray-400 text-sm">{SIZE_LABELS[sudokuSize]}{sudokuSize === 9 ? ` · ${difficulty}` : ''}</span>
                <span className="text-indigo-300 font-mono text-sm">{fmt(elapsed)}</span>
                <button
                    onClick={() => { setSeed(s => s + 1); startGame(sudokuSize, difficulty); }}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
                >
                    New
                </button>
                <button
                    onClick={() => setPhase('levelSelect')}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
                >
                    ← Menu
                </button>
            </div>

            {/* Grid */}
            <div
                className="border-2 border-white/50 rounded-lg overflow-hidden"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${sudokuSize}, 1fr)` }}
            >
                {userGrid.map((row, ri) =>
                    row.map((val, ci) => {
                        const isGiven = puzzle[ri][ci] !== 0;
                        const isSelected = ri === selR && ci === selC;
                        const isHighlighted = ri === selR || ci === selC || boxOf(ri, ci, sudokuSize) === selBox;
                        const isSameVal = selVal !== 0 && val === selVal && !isSelected;
                        const isError = errors.has(`${ri}-${ci}`);

                        let bg = 'bg-gray-900';
                        if (isSelected)    bg = 'bg-indigo-600';
                        else if (isError)  bg = 'bg-red-900/60';
                        else if (isSameVal) bg = 'bg-indigo-900/50';
                        else if (isHighlighted) bg = 'bg-gray-800';

                        return (
                            <button
                                key={`${ri}-${ci}`}
                                onClick={() => setSelected([ri, ci])}
                                className={`
                                    ${cellSizeCls} flex items-center justify-center
                                    border border-white/10 font-semibold transition-colors
                                    ${bg}
                                    ${isGiven ? 'text-white' : isError ? 'text-red-400' : 'text-indigo-300'}
                                    ${boxBorderClass(ri, ci)}
                                `}
                            >
                                {val !== 0 ? val : ''}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Number pad */}
            <div className="flex gap-2 mt-5 flex-wrap justify-center">
                {numPad.map(n => (
                    <button
                        key={n}
                        onClick={() => handleInput(n)}
                        className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-indigo-700 text-white font-bold text-base transition-colors"
                    >
                        {n}
                    </button>
                ))}
                <button
                    onClick={() => handleInput(0)}
                    className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-red-800 text-gray-400 font-bold text-sm transition-colors"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

export default SudokuGame;
