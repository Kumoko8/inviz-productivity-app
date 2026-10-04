import React, { useState, useRef } from 'react';
import { CellState, getClueStatus } from './nonogramUtils';

interface Props {
    size: number;
    rowClues: number[][];
    colClues: number[][];
    grid: CellState[][];
    onChange: (row: number, col: number, newState: CellState) => void;
}

// Click cycles: empty → filled → marked → empty
const cycleCell = (cur: CellState): CellState =>
    cur === 'empty' ? 'filled' : cur === 'filled' ? 'marked' : 'empty';

type DragAction = 'fill' | 'erase' | 'unmark' | 'mark';

// Pixel size of each cell per grid-size
const CELL_SIZE: Record<number, number> = { 5: 44, 10: 32, 20: 22 };
const FONT_SIZE: Record<number, number> = { 5: 14, 10: 11, 20: 10 };
const DEFAULT_CELL = 22;
const DEFAULT_FONT = 10;

export const NonogramGrid: React.FC<Props> = ({
    size,
    rowClues,
    colClues,
    grid,
    onChange,
}) => {
    const cellPx = CELL_SIZE[size] ?? DEFAULT_CELL;
    const fontPx = FONT_SIZE[size] ?? DEFAULT_FONT;

    const [hoverRow, setHoverRow] = useState<number | null>(null);
    const [hoverCol, setHoverCol] = useState<number | null>(null);

    const isDragging = useRef(false);
    const dragAction = useRef<DragAction>('fill');

    const { rows: rowDone, cols: colDone } = getClueStatus(grid, rowClues, colClues);

    // Layout measurements
    const maxColItems = Math.max(...colClues.map(c => c.length), 1);
    const maxRowItems = Math.max(...rowClues.map(r => r.length), 1);
    // Height of the column-clue header (stack of numbers)
    const colClueHeight = maxColItems * Math.round(cellPx * 0.88);
    // Width of the row-clue sidebar (numbers side-by-side)
    const rowClueWidth = maxRowItems * (size <= 5 ? 22 : 18);

    // ─── Drag helpers ─────────────────────────────────────────
    const applyDrag = (r: number, c: number) => {
        const cur = grid[r][c];
        if (dragAction.current === 'fill' && cur === 'empty') onChange(r, c, 'filled');
        else if (dragAction.current === 'erase' && cur === 'filled') onChange(r, c, 'empty');
        else if (dragAction.current === 'unmark' && cur === 'marked') onChange(r, c, 'empty');
        else if (dragAction.current === 'mark' && cur !== 'marked') onChange(r, c, 'marked');
    };

    const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        const cur = grid[r][c];
        if (e.button === 2) {
            // Right-click: toggle mark on this cell, drag marks more
            const next: CellState = cur === 'marked' ? 'empty' : 'marked';
            onChange(r, c, next);
            dragAction.current = next === 'marked' ? 'mark' : 'unmark';
        } else {
            // Left-click: cycle the cell state
            onChange(r, c, cycleCell(cur));
            if (cur === 'empty') dragAction.current = 'fill';
            else if (cur === 'filled') dragAction.current = 'erase';
            else dragAction.current = 'unmark';
        }
    };

    const handleMouseEnter = (r: number, c: number) => {
        setHoverRow(r);
        setHoverCol(c);
        if (isDragging.current) applyDrag(r, c);
    };

    // Stop drag anywhere in the document
    React.useEffect(() => {
        const stop = () => { isDragging.current = false; };
        window.addEventListener('mouseup', stop);
        return () => window.removeEventListener('mouseup', stop);
    }, []);

    // ─── Border helpers ────────────────────────────────────────
    // Thick separator every 5 cells (only for grids larger than 5)
    const borderR = (c: number): string =>
        size > 5 && (c + 1) % 5 === 0 && c < size - 1
            ? '2px solid #6b7280'
            : '1px solid #374151';
    const borderB = (r: number): string =>
        size > 5 && (r + 1) % 5 === 0 && r < size - 1
            ? '2px solid #6b7280'
            : '1px solid #374151';

    const colClueItemH = colClueHeight / maxColItems;

    return (
        <div
            className="overflow-auto rounded select-none"
            onMouseLeave={() => { setHoverRow(null); setHoverCol(null); }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `${rowClueWidth}px repeat(${size}, ${cellPx}px)`,
                    gridTemplateRows: `${colClueHeight}px repeat(${size}, ${cellPx}px)`,
                }}
            >
                {/* ── Top-left corner ── */}
                <div />

                {/* ── Column clues ── */}
                {colClues.map((clue, c) => (
                    <div
                        key={c}
                        className={`flex flex-col items-center justify-end pb-0.5 transition-colors duration-75 ${hoverCol === c ? 'bg-cyan-900/30' : ''}`}
                        style={{ width: cellPx, height: colClueHeight }}
                    >
                        {clue.map((n, i) => (
                            <span
                                key={i}
                                style={{
                                    fontSize: fontPx,
                                    height: colClueItemH,
                                    display: 'flex',
                                    alignItems: 'center',
                                    lineHeight: 1,
                                }}
                                className={`font-mono font-bold ${colDone[c] ? 'text-yellow-400' : 'text-gray-200'}`}
                            >
                                {n === 0 ? '·' : n}
                            </span>
                        ))}
                    </div>
                ))}

                {/* ── Rows: clue + cells ── */}
                {rowClues.map((clue, r) => (
                    <React.Fragment key={r}>
                        {/* Row clue */}
                        <div
                            className={`flex items-center justify-end pr-1.5 gap-[2px] transition-colors duration-75 ${hoverRow === r ? 'bg-cyan-900/30' : ''}`}
                            style={{ width: rowClueWidth, height: cellPx }}
                        >
                            {clue.map((n, i) => (
                                <span
                                    key={i}
                                    style={{ fontSize: fontPx }}
                                    className={`font-mono font-bold ${rowDone[r] ? 'text-yellow-400' : 'text-gray-200'}`}
                                >
                                    {n === 0 ? '·' : n}
                                </span>
                            ))}
                        </div>

                        {/* Cells */}
                        {grid[r].map((cell, c) => {
                            const isHovered = hoverRow === r || hoverCol === c;
                            const filled = cell === 'filled';
                            const marked = cell === 'marked';

                            let bg: string;
                            if (filled) bg = '#c026d3'; // fuchsia-600 (magenta)
                            else if (isHovered) bg = '#083344'; // dark cyan tint
                            else bg = '#111827'; // gray-900

                            return (
                                <div
                                    key={c}
                                    style={{
                                        width: cellPx,
                                        height: cellPx,
                                        backgroundColor: bg,
                                        borderRight: borderR(c),
                                        borderBottom: borderB(r),
                                        borderTop: r === 0 ? '1px solid #374151' : 'none',
                                        borderLeft: c === 0 ? '1px solid #374151' : 'none',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.05s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    onMouseDown={e => handleMouseDown(r, c, e)}
                                    onMouseEnter={() => handleMouseEnter(r, c)}
                                    onContextMenu={e => e.preventDefault()}
                                >
                                    {marked && (
                                        <span
                                            style={{ fontSize: fontPx + 2, lineHeight: 1 }}
                                            className="font-bold text-yellow-300 pointer-events-none"
                                        >
                                            ✕
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
