import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TrainingCharacterState } from '../training/TrainingCharacterCard';
import { fetchAnimUrl } from '../../utils/storageUtils';
import { addPuzzleSession } from '../../services/trainingDataService';
import { NonogramGrid } from './NonogramGrid';
import PuzzleCharacterCard from './PuzzleCharacterCard';
import { ColoringMode } from '../coloring/ColoringMode';
import SudokuGame from './SudokuGame';
import DrawnSword from './DrawnSword';
import KanjiDrop from './KanjiDrop';
import BuriedTreasure from './BuriedTreasure';
import HebrewDrop from './HebrewDrop';
import {
    CellState,
    NonogramPuzzle,
    generateNonogram,
    makeEmptyGrid,
    checkSolved,
    computePuzzleXP,
    formatTime,
} from './nonogramUtils';

// Accepts the same rich shape that ClassMode already maps for TrainingMode.
// Only the fields used by puzzle mode are read — the rest are ignored.
export interface PuzzleCharacterOption {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    xp: number;
    level: number;
    animUrl?: string;
    animPath?: string;
    [key: string]: unknown; // allow extra TrainingMode fields
}

export interface PuzzleModeProps {
    uid?: string | null;
    allCharacters: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, amount: number) => void;
    onClose: () => void;
}

type Phase = 'topic' | 'gridSubtopic' | 'charSelect' | 'level' | 'goalSetup' | 'puzzle' | 'complete' | 'coloringSubtopic';

const COLORING_SUBTOPICS = [
    { label: 'Animals', slug: 'animals', emoji: '🐾' },
    { label: 'Invisible Characters', slug: 'invisible-characters', emoji: '👻' },
    { label: 'Math Coloring', slug: 'math-coloring', emoji: '🔢' },
] as const;

const LEVEL_CONFIG = {
    1: { label: '5×5', size: 5, desc: 'Beginner', baseXP: 50 },
    2: { label: '10×10', size: 10, desc: 'Intermediate', baseXP: 150 },
    3: { label: '20×20', size: 20, desc: 'Advanced', baseXP: 400 },
} as const;

const GOAL_PRESETS = [
    { label: '1 min', s: 60 },
    { label: '3 min', s: 180 },
    { label: '5 min', s: 300 },
    { label: '10 min', s: 600 },
];

export const PuzzleMode: React.FC<PuzzleModeProps> = ({
    uid,
    allCharacters,
    onAwardXP,
    onClose,
}) => {
    const [phase, setPhase] = useState<Phase>('topic');
    const [level, setLevel] = useState<1 | 2 | 3 | null>(null);
    const [puzzle, setPuzzle] = useState<NonogramPuzzle | null>(null);
    const [grid, setGrid] = useState<CellState[][] | null>(null);
    const [timerRunning, setTimerRunning] = useState(false);
    const [elapsed, setElapsed] = useState(0); // display state, updated every second
    const [goalMins, setGoalMins] = useState('');
    const [goalSecs, setGoalSecs] = useState('');
    const [goalSeconds, setGoalSeconds] = useState<number | null>(null);
    const [awardedXP, setAwardedXP] = useState(0);
    const [solved, setSolved] = useState(false);
    const [seedOffset, setSeedOffset] = useState(0);
    const [charStates, setCharStates] = useState<TrainingCharacterState[]>([]);
    const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
    const [charSearch, setCharSearch] = useState('');
    const [coloringSubtopic, setColoringSubtopic] = useState<string | null>(null);
    const [showColoring, setShowColoring] = useState(false);
    const [showSudoku, setShowSudoku] = useState(false);
    const [showDrawnSword, setShowDrawnSword] = useState(false);
    const [showKanjiDrop, setShowKanjiDrop] = useState(false);
    const [showBuriedTreasure, setShowBuriedTreasure] = useState(false);
    const [showHebrewDrop, setShowHebrewDrop] = useState(false);

    const elapsedRef = useRef(0);
    const goalSecondsRef = useRef<number | null>(null);
    const levelRef = useRef<1 | 2 | 3 | null>(null);
    const gridRef = useRef<CellState[][] | null>(null);
    const puzzleRef = useRef<NonogramPuzzle | null>(null);
    const timerRef = useRef<number | null>(null);
    const selectedCharIdsRef = useRef<Set<string>>(new Set());
    const uidRef = useRef<string | null | undefined>(uid);

    // Keep refs in sync with state
    useEffect(() => { goalSecondsRef.current = goalSeconds; }, [goalSeconds]);
    useEffect(() => { levelRef.current = level; }, [level]);
    useEffect(() => { gridRef.current = grid; }, [grid]);
    useEffect(() => { puzzleRef.current = puzzle; }, [puzzle]);
    useEffect(() => { selectedCharIdsRef.current = selectedCharIds; }, [selectedCharIds]);
    useEffect(() => { uidRef.current = uid; }, [uid]);

    // ─── Resolve idle animation URLs for all characters ───────────────
    useEffect(() => {
        let cancelled = false;

        const initial: TrainingCharacterState[] = allCharacters.map(c => ({
            id: c.id,
            name: c.name,
            hp: c.hp,
            maxHp: c.maxHp,
            xp: c.xp,
            level: c.level,
            animUrl: c.animUrl || undefined,
        }));
        setCharStates(initial);

        (async () => {
            for (const char of allCharacters) {
                if (cancelled) break;
                if (char.animUrl || !char.animPath) continue;
                try {
                    const url = await fetchAnimUrl(char.animPath);
                    if (cancelled) break;
                    setCharStates(prev =>
                        prev.map(s => s.id === char.id ? { ...s, animUrl: url || undefined } : s)
                    );
                } catch {
                    // URL unavailable — card shows placeholder
                }
            }
        })();

        return () => { cancelled = true; };
        // Re-run only when the set of character IDs changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allCharacters.map(c => c.id).join(',')]);

    // ─── Timer ────────────────────────────────────────────────────────
    useEffect(() => {
        if (timerRunning) {
            timerRef.current = window.setInterval(() => {
                elapsedRef.current += 1;
                setElapsed(elapsedRef.current);
            }, 1000);
        } else {
            if (timerRef.current !== null) window.clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current !== null) window.clearInterval(timerRef.current);
        };
    }, [timerRunning]);

    // ─── Phase actions ────────────────────────────────────────────────
    const beginPuzzle = useCallback((lvl: 1 | 2 | 3, offset: number) => {
        const cfg = LEVEL_CONFIG[lvl];
        const p = generateNonogram(cfg.size, offset);
        const g = makeEmptyGrid(cfg.size);
        elapsedRef.current = 0;
        setElapsed(0);
        setLevel(lvl);
        setPuzzle(p);
        setGrid(g);
        gridRef.current = g;
        puzzleRef.current = p;
        setSolved(false);
        setPhase('goalSetup');
    }, []);

    const launchPuzzle = (goal: number | null) => {
        setGoalSeconds(goal);
        goalSecondsRef.current = goal;
        setTimerRunning(true);
        setPhase('puzzle');
    };

    const handleStartWithGoal = () => {
        const m = parseInt(goalMins || '0', 10);
        const s = parseInt(goalSecs || '0', 10);
        const total = (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
        launchPuzzle(total > 0 ? total : null);
    };

    // Stable callback — reads from refs so grid re-renders don't recreate it every second
    const handleCellChange = useCallback((row: number, col: number, newState: CellState) => {
        const curGrid = gridRef.current;
        const curPuzzle = puzzleRef.current;
        if (!curGrid || !curPuzzle) return;

        const newGrid = curGrid.map((r, ri) =>
            ri === row ? r.map((c, ci) => (ci === col ? newState : c)) : r
        );
        gridRef.current = newGrid;
        setGrid(newGrid);

        if (checkSolved(newGrid, curPuzzle.rowClues, curPuzzle.colClues)) {
            setTimerRunning(false);
            setSolved(true);
            const xp = computePuzzleXP(
                elapsedRef.current,
                goalSecondsRef.current,
                levelRef.current ?? 1
            );
            setAwardedXP(xp);
            const lvl = levelRef.current ?? 1;
            const cfg = LEVEL_CONFIG[lvl];
            const now = Date.now();
            if (onAwardXP) {
                for (const char of allCharacters) {
                    if (selectedCharIdsRef.current.has(char.id)) onAwardXP(char.id, xp);
                }
            }
            if (uidRef.current) {
                for (const char of allCharacters) {
                    if (selectedCharIdsRef.current.has(char.id)) {
                        addPuzzleSession(uidRef.current, char.id, {
                            date: now,
                            puzzleType: 'Nonogram',
                            label: cfg.label,
                            level: lvl,
                            elapsedSeconds: elapsedRef.current,
                            goalSeconds: goalSecondsRef.current,
                            solved: true,
                            xpAwarded: xp,
                            charName: char.name,
                        });
                    }
                }
            }
            setTimeout(() => setPhase('complete'), 700);
        }
    }, [allCharacters, onAwardXP]);

    const handleGiveUp = () => {
        setTimerRunning(false);
        setAwardedXP(0);
        setSolved(false);
        // Record give-up session for selected characters
        if (uid && level) {
            const cfg = LEVEL_CONFIG[level];
            const now = Date.now();
            for (const char of allCharacters) {
                if (selectedCharIdsRef.current.has(char.id)) {
                    addPuzzleSession(uid, char.id, {
                        date: now,
                        puzzleType: 'Nonogram',
                        label: cfg.label,
                        level,
                        elapsedSeconds: elapsedRef.current,
                        goalSeconds: goalSecondsRef.current,
                        solved: false,
                        xpAwarded: 0,
                        charName: char.name,
                    });
                }
            }
        }
        setPhase('complete');
    };

    const handlePlayAgain = () => {
        setSeedOffset(o => o + 1);
        setPhase('level');
    };

    const toggleCharacter = (id: string) => {
        setSelectedCharIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else if (next.size < 2) next.add(id);
            return next;
        });
    };

    // ─── Phase: topic ─────────────────────────────────────────────────
    if (phase === 'topic') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-end px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h1 className="text-3xl font-bold text-white mb-2">Puzzle Mode</h1>
                <p className="text-gray-400 mb-10 text-sm">Select a puzzle type to begin</p>
                <div className="flex flex-col gap-4 w-72">
                    <button
                        onClick={() => setPhase('gridSubtopic')}
                        className="py-6 rounded-2xl border-2 border-fuchsia-600 bg-gray-900 hover:bg-fuchsia-900/30 hover:border-fuchsia-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">🎨</div>
                        <div className="text-lg font-bold text-white group-hover:text-fuchsia-300">
                            Grid Puzzles
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Nonograms</div>
                    </button>
                    <button
                        onClick={() => setPhase('coloringSubtopic')}
                        className="py-6 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">🖌️</div>
                        <div className="text-lg font-bold text-white group-hover:text-cyan-300">
                            Coloring
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Animals · Characters · Math</div>
                    </button>
                </div>
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: gridSubtopic ──────────────────────────────────────────
    if (phase === 'gridSubtopic') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={() => setPhase('topic')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-2">Grid Puzzles</h2>
                <p className="text-gray-400 text-sm mb-8">Pick a game to play</p>
                <div className="flex flex-col gap-4 w-72">
                    <button
                        onClick={() => setPhase('charSelect')}
                        className="py-6 rounded-2xl border-2 border-fuchsia-600 bg-gray-900 hover:bg-fuchsia-900/30 hover:border-fuchsia-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">🎨</div>
                        <div className="text-lg font-bold text-white group-hover:text-fuchsia-300">
                            Nonograms
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Picture logic · Earn XP</div>
                    </button>
                    <button
                        onClick={() => setShowSudoku(true)}
                        className="py-6 rounded-2xl border-2 border-indigo-700 bg-gray-900 hover:bg-indigo-900/30 hover:border-indigo-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">🔢</div>
                        <div className="text-lg font-bold text-white group-hover:text-indigo-300">
                            Sudoku
                        </div>
                        <div className="text-sm text-gray-500 mt-1">3×3 · 4×4 · 6×6 · 9×9</div>
                    </button>
                    <button
                        onClick={() => setShowKanjiDrop(true)}
                        className="py-6 rounded-2xl border-2 border-yellow-700 bg-gray-900 hover:bg-yellow-900/30 hover:border-yellow-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2 text-white">漢</div>
                        <div className="text-lg font-bold text-white group-hover:text-yellow-300">
                            Kanji Drop
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Merge radicals </div>
                    </button>
                    <button
                        onClick={() => setShowDrawnSword(true)}
                        className="py-6 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">⚔️</div>
                        <div className="text-lg font-bold text-white group-hover:text-cyan-300">
                            Drawn Sword
                        </div>
                        <div className="text-sm text-gray-500 mt-1">3 · 4 · 5 · 6 · 7 letter words</div>
                    </button>
                    <button
                        onClick={() => setShowBuriedTreasure(true)}
                        className="py-6 rounded-2xl border-2 border-amber-700 bg-gray-900 hover:bg-amber-900/30 hover:border-amber-400 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2">💎</div>
                        <div className="text-lg font-bold text-white group-hover:text-amber-300">
                            Buried Treasure
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Merge gems · Suika-style</div>
                    </button>
                    <button
                        onClick={() => setShowHebrewDrop(true)}
                        className="py-6 rounded-2xl border-2 border-yellow-900 bg-gray-900 hover:bg-yellow-950/60 hover:border-yellow-700 transition-all text-left px-6 group"
                    >
                        <div className="text-2xl mb-2" style={{ fontFamily: 'serif', color: '#d97706' }}>א</div>
                        <div className="text-lg font-bold text-white group-hover:text-yellow-200">
                            Hebrew Drop
                        </div>
                        <div className="text-sm text-gray-500 mt-1">Spell Biblical Hebrew vocab · Right to left</div>
                    </button>
                </div>
                {showSudoku && (
                    <SudokuGame
                        allCharacters={allCharacters}
                        onAwardXP={onAwardXP}
                        onClose={() => {
                            setShowSudoku(false);
                            setPhase('gridSubtopic');
                        }}
                    />
                )}
                {showDrawnSword && (
                    <DrawnSword
                        allCharacters={allCharacters}
                        onAwardXP={onAwardXP}
                        onClose={() => {
                            setShowDrawnSword(false);
                            setPhase('gridSubtopic');
                        }}
                    />
                )}
                {showKanjiDrop && (
                    <KanjiDrop
                        allCharacters={allCharacters}
                        onAwardXP={onAwardXP}
                        onClose={() => {
                            setShowKanjiDrop(false);
                            setPhase('gridSubtopic');
                        }}
                    />
                )}
                {showBuriedTreasure && (
                    <BuriedTreasure
                        allCharacters={allCharacters}
                        onClose={() => {
                            setShowBuriedTreasure(false);
                            setPhase('gridSubtopic');
                        }}
                    />
                )}
                {showHebrewDrop && (
                    <HebrewDrop
                        allCharacters={allCharacters}
                        onAwardXP={onAwardXP}
                        onClose={() => {
                            setShowHebrewDrop(false);
                            setPhase('gridSubtopic');
                        }}
                    />
                )}
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: coloringSubtopic ──────────────────────────────────────
    if (phase === 'coloringSubtopic') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={() => setPhase('topic')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-2">Coloring</h2>
                <p className="text-gray-400 text-sm mb-8">Pick a category to color</p>
                <div className="flex flex-col gap-4 w-72">
                    {COLORING_SUBTOPICS.map(({ label, slug, emoji }) => (
                        <button
                            key={slug}
                            onClick={() => {
                                setColoringSubtopic(slug);
                                setShowColoring(true);
                            }}
                            className="py-5 px-6 rounded-2xl border-2 border-cyan-700 bg-gray-900 hover:bg-cyan-900/30 hover:border-cyan-400 transition-all text-left group"
                        >
                            <div className="text-xl mb-1">{emoji}</div>
                            <div className="text-lg font-bold text-white group-hover:text-cyan-300">
                                {label}
                            </div>
                        </button>
                    ))}
                </div>
                {showColoring && (
                    <ColoringMode
                        uid={uid}
                        subfolder={coloringSubtopic ?? undefined}
                        onClose={() => {
                            setShowColoring(false);
                            setPhase('topic');
                        }}
                    />
                )}
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: charSelect ────────────────────────────────────────────
    if (phase === 'charSelect') {
        const filtered = allCharacters.filter(c =>
            c.name.toLowerCase().includes(charSearch.toLowerCase())
        );
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={() => setPhase('topic')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-1">Choose Characters</h2>
                <p className="text-gray-400 text-sm mb-4">Select up to 2 · they earn XP on solve</p>

                {/* Search bar */}
                <div className="relative w-80 mb-3">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                    <input
                        type="text"
                        placeholder="Search by name…"
                        value={charSearch}
                        onChange={e => setCharSearch(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                </div>

                {/* Character list */}
                <div className="overflow-y-auto max-h-64 w-80 space-y-1.5 pr-1">
                    {filtered.map(c => {
                        const isSelected = selectedCharIds.has(c.id);
                        const isDisabled = !isSelected && selectedCharIds.size >= 2;
                        return (
                            <button
                                key={c.id}
                                disabled={isDisabled}
                                onClick={() => toggleCharacter(c.id)}
                                className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all flex items-center justify-between ${isSelected
                                    ? 'border-fuchsia-500 bg-fuchsia-900/30 text-white'
                                    : isDisabled
                                        ? 'border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed'
                                        : 'border-gray-700 bg-gray-900 hover:border-fuchsia-500/50 hover:bg-fuchsia-900/10 text-gray-300'
                                    }`}
                            >
                                <span className="font-medium text-sm">{c.name}</span>
                                {isSelected && <span className="text-fuchsia-400 text-sm font-bold">✓</span>}
                            </button>
                        );
                    })}
                    {filtered.length === 0 && (
                        <p className="text-gray-600 text-sm italic text-center py-4">No characters found</p>
                    )}
                </div>

                <button
                    onClick={() => setPhase('level')}
                    className="mt-6 py-3 px-8 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-colors"
                >
                    Continue
                </button>
                {selectedCharIds.size === 0 ? (
                    <p className="text-gray-600 text-xs mt-2">No selection = no XP awarded</p>
                ) : (
                    <p className="text-fuchsia-500 text-xs mt-2">{selectedCharIds.size} of 2 selected</p>
                )}
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: level ─────────────────────────────────────────────────
    if (phase === 'level') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={() => setPhase('charSelect')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-1">Nonogram</h2>
                <p className="text-gray-400 text-sm mb-8">Choose a grid size</p>
                <div className="flex flex-col gap-4 w-72">
                    {([1, 2, 3] as const).map(lvl => {
                        const cfg = LEVEL_CONFIG[lvl];
                        return (
                            <button
                                key={lvl}
                                onClick={() => beginPuzzle(lvl, seedOffset)}
                                className="py-4 px-6 rounded-xl border-2 border-gray-700 bg-gray-900 hover:border-fuchsia-500 hover:bg-fuchsia-900/20 transition-all text-left group"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-bold text-white group-hover:text-fuchsia-300">
                                        {cfg.label}
                                    </span>
                                    <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                                        up to {cfg.baseXP} XP
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 mt-0.5">{cfg.desc}</div>
                            </button>
                        );
                    })}
                </div>
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: goalSetup ─────────────────────────────────────────────
    if (phase === 'goalSetup') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                <div className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/40">
                    <button
                        onClick={() => setPhase('level')}
                        className="text-gray-400 hover:text-white text-sm"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-xl"
                    >
                        ✕
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-1">Set a Time Goal</h2>
                <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
                    XP scales with how close your finish time is to your goal.
                    Finishing within 50% of the goal earns partial XP — beyond that earns 0.
                    Skip to always earn the full base XP.
                </p>
                {/* Presets */}
                <div className="flex flex-wrap gap-2 mb-4 justify-center">
                    {GOAL_PRESETS.map(p => (
                        <button
                            key={p.s}
                            onClick={() => {
                                setGoalMins(String(Math.floor(p.s / 60)));
                                setGoalSecs(String(p.s % 60).padStart(2, '0'));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-cyan-900/40 text-sm text-gray-300 border border-gray-700 hover:border-cyan-500 transition-colors"
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {/* Manual input */}
                <div className="flex items-center gap-2 mb-6">
                    <input
                        type="number"
                        min={0}
                        placeholder="mm"
                        value={goalMins}
                        onChange={e => setGoalMins(e.target.value)}
                        className="w-16 text-center bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white text-lg focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-white text-xl font-bold">:</span>
                    <input
                        type="number"
                        min={0}
                        max={59}
                        placeholder="ss"
                        value={goalSecs}
                        onChange={e => setGoalSecs(e.target.value)}
                        className="w-16 text-center bg-gray-800 border border-gray-600 rounded-lg px-2 py-2 text-white text-lg focus:outline-none focus:border-cyan-500"
                    />
                </div>
                <div className="flex flex-col gap-3 w-64">
                    <button
                        onClick={handleStartWithGoal}
                        className="py-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-lg transition-colors"
                    >
                        Start Puzzle
                    </button>
                    <button
                        onClick={() => launchPuzzle(null)}
                        className="py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors"
                    >
                        Skip (no goal)
                    </button>
                </div>
                </div>
                </div>
            </div>
        );
    }

    // ─── Phase: puzzle ────────────────────────────────────────────────
    if (phase === 'puzzle' && puzzle && grid) {
        const cfg = LEVEL_CONFIG[level ?? 1];
        const goalLabel = goalSeconds ? formatTime(goalSeconds) : null;

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0 gap-2">
                    <div className="flex items-center gap-3">
                        <span className="text-cyan-400 text-lg">⏱</span>
                        <span className="font-mono text-lg font-bold text-cyan-300">
                            {formatTime(elapsed)}
                        </span>
                        {goalLabel && (
                            <span className="text-xs text-gray-500">/ goal {goalLabel}</span>
                        )}
                    </div>
                    <span className="text-sm text-gray-500">Nonogram {cfg.label}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGiveUp}
                            className="px-3 py-1 rounded text-xs bg-gray-800 text-gray-400 hover:bg-red-900/40 hover:text-red-400 transition-colors"
                        >
                            Give Up
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-white text-lg ml-1"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                    {/* Puzzle area — 2/3 */}
                    <div className="flex-[2] flex items-center justify-center overflow-auto p-4 relative">
                        {solved && (
                            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                <span className="text-4xl font-black text-yellow-400 drop-shadow-lg animate-bounce">
                                    ✓ Solved!
                                </span>
                            </div>
                        )}
                        <NonogramGrid
                            size={puzzle.size}
                            rowClues={puzzle.rowClues}
                            colClues={puzzle.colClues}
                            grid={grid}
                            onChange={handleCellChange}
                        />
                    </div>

                    {/* Character sidebar — 1/3 */}
                    <div className="flex-[1] flex flex-col gap-3 p-3 overflow-y-auto border-l border-gray-800 min-w-0">
                        <span className="text-xs text-gray-600 uppercase tracking-wide">
                            Characters
                        </span>
                        {charStates.filter(c => selectedCharIds.has(c.id)).length === 0 ? (
                            <p className="text-xs text-gray-600 italic">No characters selected</p>
                        ) : (
                            charStates
                                .filter(c => selectedCharIds.has(c.id))
                                .map(c => (
                                    <PuzzleCharacterCard key={c.id} character={c} />
                                ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ─── Phase: complete ──────────────────────────────────────────────
    if (phase === 'complete') {
        const charCount = allCharacters.filter(c => selectedCharIds.has(c.id)).length;

        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center overflow-y-auto p-6">
                <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">{solved ? '🎉' : '😓'}</div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                        {solved ? 'Puzzle Solved!' : 'Better luck next time'}
                    </h2>

                    {solved ? (
                        <>
                            <div className="text-gray-400 text-sm mb-4">
                                Time:{' '}
                                <span className="text-cyan-300 font-mono font-bold">
                                    {formatTime(elapsedRef.current)}
                                </span>
                                {goalSeconds && (
                                    <span className="text-gray-500 ml-2">
                                        / goal {formatTime(goalSeconds)}
                                    </span>
                                )}
                            </div>
                            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 mb-6">
                                <div className="text-yellow-400 font-bold text-3xl">
                                    +{awardedXP} XP
                                </div>
                                <div className="text-yellow-600 text-sm mt-1">
                                    {charCount > 0
                                        ? `Awarded to ${charCount} character${charCount !== 1 ? 's' : ''}`
                                        : 'No characters to award'}
                                </div>
                                {goalSeconds !== null && awardedXP === 0 && (
                                    <div className="text-gray-500 text-xs mt-2">
                                        Finish time was more than 50% off your goal
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500 text-sm mb-6">No XP awarded</p>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handlePlayAgain}
                            className="py-3 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-colors"
                        >
                            New Puzzle
                        </button>
                        <button
                            onClick={onClose}
                            className="py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};
