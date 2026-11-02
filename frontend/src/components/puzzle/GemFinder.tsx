import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Difficulty = 'easy' | 'medium' | 'hard';
type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

interface Cell {
    mine: boolean;
    adjacent: number;
    revealed: boolean;
    flagged: boolean;
}

interface DifficultyConfig {
    label: string;
    size: number;
    mines: number;
}

export interface GemFinderProps {
    onClose: () => void;
}

const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
    easy: { label: 'Easy', size: 8, mines: 10 },
    medium: { label: 'Medium', size: 10, mines: 18 },
    hard: { label: 'Hard', size: 12, mines: 30 },
};

const buildEmptyBoard = (size: number): Cell[][] =>
    Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({
            mine: false,
            adjacent: 0,
            revealed: false,
            flagged: false,
        })),
    );

const neighborsOf = (row: number, col: number, size: number): [number, number][] => {
    const neighbors: [number, number][] = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const nextRow = row + rowOffset;
            const nextCol = col + colOffset;
            if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) {
                neighbors.push([nextRow, nextCol]);
            }
        }
    }
    return neighbors;
};

const createBoard = (size: number, mines: number, safeRow: number, safeCol: number): Cell[][] => {
    const board = buildEmptyBoard(size);
    const blocked = new Set([`${safeRow}:${safeCol}`]);
    const minePositions: string[] = [];

    while (minePositions.length < mines) {
        const row = Math.floor(Math.random() * size);
        const col = Math.floor(Math.random() * size);
        const key = `${row}:${col}`;
        if (!blocked.has(key) && !minePositions.includes(key)) minePositions.push(key);
    }

    minePositions.forEach(position => {
        const [row, col] = position.split(':').map(Number);
        board[row][col].mine = true;
    });

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            board[row][col].adjacent = neighborsOf(row, col, size)
                .filter(([neighborRow, neighborCol]) => board[neighborRow][neighborCol].mine)
                .length;
        }
    }
    return board;
};

const revealArea = (board: Cell[][], startRow: number, startCol: number): Cell[][] => {
    const next = board.map(row => row.map(cell => ({ ...cell })));
    const size = next.length;
    const queue: [number, number][] = [[startRow, startCol]];
    const visited = new Set<string>();

    while (queue.length) {
        const [row, col] = queue.shift()!;
        const key = `${row}:${col}`;
        if (visited.has(key) || next[row][col].flagged || next[row][col].revealed) continue;
        visited.add(key);
        next[row][col].revealed = true;

        if (next[row][col].adjacent === 0 && !next[row][col].mine) {
            neighborsOf(row, col, size).forEach(neighbor => {
                if (!next[neighbor[0]][neighbor[1]].mine) queue.push(neighbor);
            });
        }
    }
    return next;
};

const countFlags = (board: Cell[][]): number =>
    board.flat().filter(cell => cell.flagged).length;

const GemFinder: React.FC<GemFinderProps> = ({ onClose }) => {
    const [difficulty, setDifficulty] = useState<Difficulty>('easy');
    const [board, setBoard] = useState<Cell[][]>(() => buildEmptyBoard(DIFFICULTIES.easy.size));
    const [status, setStatus] = useState<GameStatus>('ready');
    const [seconds, setSeconds] = useState(0);

    const config = DIFFICULTIES[difficulty];
    const flags = useMemo(() => countFlags(board), [board]);

    useEffect(() => {
        if (status !== 'playing') return undefined;
        const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [status]);

    const startNewGame = useCallback((nextDifficulty = difficulty) => {
        setDifficulty(nextDifficulty);
        setBoard(buildEmptyBoard(DIFFICULTIES[nextDifficulty].size));
        setStatus('ready');
        setSeconds(0);
    }, [difficulty]);

    const finishIfWon = (nextBoard: Cell[][]) => {
        const unrevealedSafeCells = nextBoard.flat().some(cell => !cell.mine && !cell.revealed);
        if (!unrevealedSafeCells) {
            setBoard(nextBoard.map(row => row.map(cell => ({ ...cell, flagged: cell.mine || cell.flagged }))));
            setStatus('won');
        } else {
            setBoard(nextBoard);
        }
    };

    const handleReveal = (row: number, col: number) => {
        if (status === 'won' || status === 'lost' || board[row][col].flagged || board[row][col].revealed) return;

        let nextBoard = board;
        if (status === 'ready') {
            nextBoard = createBoard(config.size, config.mines, row, col);
            setStatus('playing');
        }
        if (nextBoard[row][col].mine) {
            setBoard(nextBoard.map(nextRow => nextRow.map(cell => ({
                ...cell,
                revealed: cell.mine || cell.revealed,
            }))));
            setStatus('lost');
            return;
        }
        finishIfWon(revealArea(nextBoard, row, col));
    };

    const handleFlag = (event: React.MouseEvent, row: number, col: number) => {
        event.preventDefault();
        if (status === 'won' || status === 'lost' || board[row][col].revealed) return;
        if (status === 'ready') setStatus('playing');
        if (!board[row][col].flagged && flags >= config.mines) return;
        setBoard(board.map((boardRow, rowIndex) =>
            rowIndex === row
                ? boardRow.map((cell, colIndex) => colIndex === col ? { ...cell, flagged: !cell.flagged } : cell)
                : boardRow,
        ));
    };

    const statusMessage = status === 'won'
        ? 'All gems found!'
        : status === 'lost'
            ? 'A gem shard was hiding there...'
            : status === 'ready'
                ? 'Choose a tile to begin. Your first reveal is always safe.'
                : 'Find every gem and avoid the gem shards.';

    return (
        <div className="fixed inset-0 z-[60] bg-gray-950 flex flex-col">
            <header className="shrink-0 flex items-center justify-between px-4 h-12 border-b border-gray-800/60">
                <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">← Back to puzzles</button>
                <button onClick={onClose} className="text-gray-400 hover:text-white text-xl" aria-label="Close GemFinder">✕</button>
            </header>
            <main className="flex-1 overflow-y-auto px-4 py-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-5">
                        <div className="text-4xl mb-1">💎</div>
                        <h1 className="text-3xl font-bold text-white">GemFinder</h1>
                        <p className="text-gray-400 text-sm mt-1">{statusMessage}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                        {(Object.keys(DIFFICULTIES) as Difficulty[]).map(level => (
                            <button
                                key={level}
                                onClick={() => startNewGame(level)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${difficulty === level
                                    ? 'bg-emerald-500 text-gray-950'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                            >
                                {DIFFICULTIES[level].label}
                            </button>
                        ))}
                        <button onClick={() => startNewGame()} className="px-4 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-sm font-semibold">
                            New game
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-8 mb-4 text-sm">
                        <span className="text-gray-300">💎 {Math.max(config.mines - flags, 0).toString().padStart(2, '0')} left</span>
                        <span className="text-gray-300">⏱️ {seconds}s</span>
                    </div>

                    <div
                        className="mx-auto grid gap-1 p-2 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl"
                        style={{ gridTemplateColumns: `repeat(${config.size}, minmax(0, 1fr))`, maxWidth: 'min(92vw, 600px)' }}
                        role="grid"
                        aria-label="GemFinder game board"
                    >
                        {board.map((row, rowIndex) => row.map((cell, colIndex) => {
                            const revealedMine = cell.revealed && cell.mine;
                            const numberColor: Record<number, string> = {
                                1: 'text-blue-400', 2: 'text-emerald-400', 3: 'text-red-400',
                                4: 'text-indigo-300', 5: 'text-orange-400', 6: 'text-cyan-300',
                                7: 'text-pink-300', 8: 'text-gray-300',
                            };
                            return (
                                <button
                                    key={`${rowIndex}:${colIndex}`}
                                    onClick={() => handleReveal(rowIndex, colIndex)}
                                    onContextMenu={event => handleFlag(event, rowIndex, colIndex)}
                                    className={`aspect-square rounded-md flex items-center justify-center text-sm sm:text-base font-black select-none transition-colors ${cell.revealed
                                        ? revealedMine ? 'bg-red-600/80' : 'bg-slate-800'
                                        : cell.flagged ? 'bg-amber-900/70 text-amber-300' : 'bg-slate-700 hover:bg-slate-600'}`}
                                    aria-label={cell.flagged ? 'Flagged tile' : cell.revealed ? (cell.mine ? 'Gem shard' : `${cell.adjacent} nearby`) : 'Hidden tile'}
                                >
                                    {cell.revealed && cell.mine ? '🔷' : cell.flagged ? '🚩' : cell.revealed && cell.adjacent > 0
                                        ? <span className={numberColor[cell.adjacent]}>{cell.adjacent}</span> : ''}
                                </button>
                            );
                        }))}
                    </div>
                    <p className="text-center text-gray-600 text-xs mt-4">Click to reveal · Right-click to flag</p>
                </div>
            </main>
        </div>
    );
};

export default GemFinder;
