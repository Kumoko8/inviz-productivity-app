/**
 * HebrewDrop — Biblical Hebrew vocab builder.
 *
 * Grid: 8 columns × 40 logical rows (scrollable, 9 rows visible at once).
 * Letters are placed horizontally; a contiguous run matching a recipe
 * (in either left-to-right or right-to-left order) auto-merges into the
 * full word tile — so users can write naturally RTL or LTR.
 */

import React, {
    useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { PuzzleCharacterOption } from './PuzzleMode';
import { useUser } from '../../context/UserContext';
import { CHAR_TO_LETTER, STANDARD_LETTERS, FINAL_LETTERS } from './HebrewDropData';
import {
    HB_RUNTIME_TILES, HB_RUNTIME_MERGE_MAP,
    COLS, TOTAL_ROWS, VISIBLE_ROWS, CELL, CANVAS_W, CANVAS_H,
    hbLookupTile, emptyGrid, resolveOneHbPass, drawHbTile, makeTile,
    type GoalGroup, type MergeAnim, type DragState, type GridCell, type GamePhase,
} from './hebrewdrop/hebrewDropTypes';
import HebrewGoalsPanel from './hebrewdrop/HebrewGoalsPanel';
import {
    loadHebrewVocab, saveHebrewVocab,
    loadHbGoalGroups, saveHbGoalGroups,
} from '../../services/hebrewDropService';
import type { HebrewVocabEntry } from '../../services/hebrewDropService';

type Recipe = { letters: string[]; xp: number };

function hashTier(id: string): number {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
    return (h % 6) + 3;
}

/** Migrate legacy { a, b, c, d, xp } recipe to the new { letters, xp } format. */
function migrateRecipe(entry: HebrewVocabEntry): HebrewVocabEntry {
    if (!entry.recipe) return entry;
    if ('letters' in entry.recipe) return entry; // already new format
    const old = entry.recipe as any;
    const letters: string[] = [old.a, old.b, old.c, old.d].filter((x: string) => x && x !== '');
    return { ...entry, recipe: { letters, xp: old.xp } };
}

interface Props {
    onClose: () => void;
    allCharacters?: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, xp: number) => void;
}

const HebrewDrop: React.FC<Props> = ({ onClose, allCharacters = [], onAwardXP }) => {
    const { user } = useUser();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const gridRef = useRef<(GridCell | null)[][]>(emptyGrid());
    const mergeAnimsRef = useRef<MergeAnim[]>([]);
    const dragRef = useRef<DragState | null>(null);
    const scoreRef = useRef<number>(0);
    const targetRef = useRef<string>('');
    const solvedCountRef = useRef<number>(0);
    const dirtyRef = useRef(true);
    const scrollRowRef = useRef(0);

    const [phase, setPhase] = useState<GamePhase>('charPick');
    const [score, setScore] = useState(0);
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const [targetId, setTargetId] = useState<string>('');
    const [solvedCount, setSolvedCount] = useState(0);
    const [mergeFlash, setMergeFlash] = useState<{ char: string; meaning: string } | null>(null);
    const [goalListOpen, setGoalListOpen] = useState(true);
    const [scrollRow, setScrollRowState] = useState(0);
    const [groups, setGroups] = useState<GoalGroup[]>(() => {
        try { const s = localStorage.getItem('hd-goal-groups'); return s ? JSON.parse(s) : []; } catch { return []; }
    });
    const [tapMode, setTapMode] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
    );
    const [selectedPaletteTile, setSelectedPaletteTile] = useState<string | null>(null);
    const tapModeRef = useRef(false);
    const selectedPaletteTileRef = useRef<string | null>(null);
    const tapHoverRef = useRef<{ cx: number; cy: number } | null>(null);
    const [vocabWords, setVocabWords] = useState<HebrewVocabEntry[]>([]);
    const vocabWordsRef = useRef<HebrewVocabEntry[]>([]);
    const deckRef = useRef<string[]>([]);
    const drawRef = useRef<() => void>(() => { });

    const allVocabIds = useMemo(() => vocabWords.map(w => w.id), [vocabWords]);
    const activeTargetPoolRef = useRef(allVocabIds);
    activeTargetPoolRef.current = allVocabIds;

    useEffect(() => { vocabWordsRef.current = vocabWords; }, [vocabWords]);

    function setScrollRow(n: number) {
        const clamped = Math.max(0, Math.min(TOTAL_ROWS - VISIBLE_ROWS, n));
        scrollRowRef.current = clamped;
        setScrollRowState(clamped);
        dirtyRef.current = true;
    }

    useEffect(() => {
        if (!user) return;
        loadHebrewVocab(user.uid).then(rawEntries => {
            const entries = rawEntries.map(migrateRecipe);
            entries.forEach(e => {
                HB_RUNTIME_TILES[e.id] = makeTile(e.id, e.char, e.meaning, hashTier(e.id));
                if (e.recipe && e.recipe.letters.length >= 2) {
                    HB_RUNTIME_MERGE_MAP.set(e.recipe.letters.join(','), { result: e.id, xp: e.recipe.xp });
                }
            });
            setVocabWords(entries);
        }).catch(err => console.warn('Could not load Hebrew vocab:', err));
    }, [user?.uid]);

    useEffect(() => {
        if (!user) return;
        loadHbGoalGroups(user.uid).then(fg => {
            if (fg.length > 0) {
                setGroups(fg);
                localStorage.setItem('hd-goal-groups', JSON.stringify(fg));
            }
        }).catch(err => console.warn('Could not load goal groups:', err));
    }, [user?.uid]);

    function pickNewTarget() {
        const pool = activeTargetPoolRef.current;
        if (pool.length === 0) return;
        if (deckRef.current.length === 0) {
            const arr = [...pool];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            deckRef.current = arr;
        }
        const id = deckRef.current.pop()!;
        targetRef.current = id;
        setTargetId(id);
    }

    /** Convert canvas pixel position to logical grid coordinates (accounts for scroll). */
    function pixelToGrid(x: number, y: number) {
        const col = Math.floor(x / CELL);
        const visRow = Math.floor(y / CELL);
        if (col < 0 || col >= COLS || visRow < 0 || visRow >= VISIBLE_ROWS) return null;
        return { col, row: scrollRowRef.current + visRow };
    }

    /** Convert logical grid position to canvas pixel centre (accounts for scroll). */
    function cellCenter(col: number, row: number) {
        return {
            cx: col * CELL + CELL / 2,
            cy: (row - scrollRowRef.current) * CELL + CELL / 2,
        };
    }

    const resolveMerges = useCallback(() => {
        dirtyRef.current = true;
        const grid = gridRef.current;
        const now = performance.now();
        let timeOffset = 0;
        let s = TOTAL_ROWS * COLS * 3;
        let pass;
        let earned = 0;
        while ((pass = resolveOneHbPass(grid)) !== null && s-- > 0) {
            if (!hbLookupTile(pass.resultId)) { grid[pass.row][pass.col] = null; break; }
            const { col: mc, row: mr, resultId, xp, absorbedCells } = pass;
            for (const [nc, nr] of absorbedCells) {
                const absDef = hbLookupTile(grid[nr][nc]!.tileId);
                if (absDef) {
                    const { cx, cy } = cellCenter(nc, nr);
                    mergeAnimsRef.current.push({ type: 'absorbed', x: cx, y: cy, color: absDef.color, textColor: absDef.textColor, glow: absDef.glow, char: absDef.char, startTime: now + timeOffset, dur: 550 });
                }
                grid[nr][nc] = null;
            }
            grid[mr][mc] = { tileId: resultId };
            const resDef = hbLookupTile(resultId);
            earned += xp * absorbedCells.length;
            if (resDef) {
                const { cx, cy } = cellCenter(mc, mr);
                mergeAnimsRef.current.push({ type: 'pulse', x: cx, y: cy, color: resDef.glow, textColor: resDef.textColor, glow: resDef.glow, char: resDef.char, startTime: now + timeOffset, dur: 550 });
                setMergeFlash({ char: resDef.char, meaning: resDef.meaning });
                setTimeout(() => setMergeFlash(null), 1500);
                if (resultId === targetRef.current) {
                    earned += 500;
                    solvedCountRef.current += 1;
                    setSolvedCount(solvedCountRef.current);
                    setTimeout(() => pickNewTarget(), 800);
                }
            }
            timeOffset += 120;
        }
        scoreRef.current += earned;
        setScore(scoreRef.current);
        if (selectedCharId && onAwardXP && earned > 0) onAwardXP(selectedCharId, earned);
    }, [selectedCharId, onAwardXP]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const now = performance.now();
        const sr = scrollRowRef.current;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#0d0a04';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        if (gridCanvasRef.current) ctx.drawImage(gridCanvasRef.current, 0, 0);

        // Drop-target highlight
        const highlightGp = dragRef.current
            ? pixelToGrid(dragRef.current.cx, dragRef.current.cy)
            : (tapHoverRef.current && selectedPaletteTileRef.current)
                ? pixelToGrid(tapHoverRef.current.cx, tapHoverRef.current.cy)
                : null;
        if (highlightGp) {
            const canvasR = highlightGp.row - sr;
            if (canvasR >= 0 && canvasR < VISIBLE_ROWS) {
                const hDef = (tapHoverRef.current && selectedPaletteTileRef.current && !dragRef.current)
                    ? hbLookupTile(selectedPaletteTileRef.current)
                    : null;
                ctx.fillStyle = hDef
                    ? hDef.glow + '33'
                    : 'rgba(217,119,6,0.12)';
                ctx.beginPath();
                ctx.roundRect(highlightGp.col * CELL + 3, canvasR * CELL + 3, CELL - 6, CELL - 6, 12);
                ctx.fill();
            }
        }

        // Draw visible grid cells
        const grid = gridRef.current;
        const drag = dragRef.current;
        for (let r = sr; r < sr + VISIBLE_ROWS; r++) {
            const row = grid[r];
            if (!row) continue;
            for (let c = 0; c < COLS; c++) {
                const cell = row[c];
                if (!cell) continue;
                if (drag?.source !== 'palette' && typeof drag?.source === 'object' && drag.source.col === c && drag.source.row === r) continue;
                drawHbTile(ctx, c * CELL + CELL / 2, (r - sr) * CELL + CELL / 2, cell.tileId);
            }
        }

        // Scroll indicator (right edge)
        const trackH = CANVAS_H - 8;
        const thumbH = Math.max(20, (VISIBLE_ROWS / TOTAL_ROWS) * trackH);
        const thumbY = 4 + ((sr / (TOTAL_ROWS - VISIBLE_ROWS)) * (trackH - thumbH));
        ctx.fillStyle = 'rgba(120,60,0,0.2)';
        ctx.beginPath(); ctx.roundRect(CANVAS_W - 6, 4, 4, trackH, 2); ctx.fill();
        ctx.fillStyle = sr > 0 || sr < TOTAL_ROWS - VISIBLE_ROWS ? 'rgba(217,119,6,0.55)' : 'rgba(120,60,0,0.15)';
        ctx.beginPath(); ctx.roundRect(CANVAS_W - 6, thumbY, 4, thumbH, 2); ctx.fill();

        // Merge animations
        mergeAnimsRef.current = mergeAnimsRef.current.filter(anim => {
            const elapsed = now - anim.startTime;
            if (elapsed < 0) return true;
            const t = Math.min(elapsed / anim.dur, 1);
            if (t >= 1) return false;
            if (anim.type === 'absorbed') {
                const s2 = (CELL * 0.88) * (1 - t * 0.85);
                const r2 = s2 * 0.38;
                ctx.save(); ctx.globalAlpha = 1 - t;
                const gs = s2 + 8;
                ctx.fillStyle = anim.glow; ctx.globalAlpha = (1 - t) * 0.3;
                ctx.beginPath(); ctx.roundRect(anim.x - gs / 2, anim.y - gs / 2, gs, gs, gs * 0.38); ctx.fill();
                ctx.globalAlpha = 1 - t; ctx.fillStyle = anim.color;
                ctx.beginPath(); ctx.roundRect(anim.x - s2 / 2, anim.y - s2 / 2, s2, s2, r2); ctx.fill();
                ctx.fillStyle = anim.textColor;
                ctx.font = `bold ${Math.round(s2 * 0.44)}px serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(anim.char, anim.x, anim.y + 1);
                ctx.restore();
            } else {
                for (let i = 0; i < 3; i++) {
                    const delay = i * 0.15;
                    const rt = Math.max(0, Math.min((t - delay) / (1 - delay), 1));
                    if (rt <= 0) continue;
                    const expand = rt * CELL * 1.1;
                    ctx.save(); ctx.globalAlpha = (1 - rt) * 0.7;
                    ctx.strokeStyle = anim.glow; ctx.lineWidth = 4 - i;
                    ctx.beginPath();
                    ctx.roundRect(anim.x - CELL / 2 - expand / 2, anim.y - CELL / 2 - expand / 2, CELL + expand, CELL + expand, (CELL / 2 + expand / 2) * 0.4);
                    ctx.stroke(); ctx.restore();
                }
            }
            return true;
        });

        if (drag) drawHbTile(ctx, drag.cx, drag.cy, drag.tileId, 0.88, 1.12);
    }, []);

    useEffect(() => { drawRef.current = draw; }, [draw]);

    // Pre-render static grid lines
    useEffect(() => {
        const offscreen = document.createElement('canvas');
        offscreen.width = CANVAS_W; offscreen.height = CANVAS_H;
        const octx = offscreen.getContext('2d')!;
        octx.strokeStyle = 'rgba(217,119,6,0.06)'; octx.lineWidth = 1;
        for (let c = 0; c <= COLS; c++) {
            octx.beginPath(); octx.moveTo(c * CELL, 0); octx.lineTo(c * CELL, CANVAS_H); octx.stroke();
        }
        for (let r = 0; r <= VISIBLE_ROWS; r++) {
            octx.beginPath(); octx.moveTo(0, r * CELL); octx.lineTo(CANVAS_W, r * CELL); octx.stroke();
        }
        // Subtle row-number hints on left edge
        octx.fillStyle = 'rgba(217,119,6,0.12)';
        octx.font = '9px monospace';
        octx.textAlign = 'left'; octx.textBaseline = 'top';
        for (let r = 0; r < VISIBLE_ROWS; r++) {
            octx.fillText((r + 1).toString(), 2, r * CELL + 2);
        }
        gridCanvasRef.current = offscreen;
        dirtyRef.current = true;
    }, []);

    // rAF loop
    useEffect(() => {
        if (phase !== 'playing') return;
        dirtyRef.current = true;
        let animId: number;
        const loop = () => {
            const hasDrag = dragRef.current !== null;
            const hasAnims = mergeAnimsRef.current.length > 0;
            const hasTapHover = tapHoverRef.current !== null && selectedPaletteTileRef.current !== null;
            if (dirtyRef.current || hasDrag || hasAnims || hasTapHover) { drawRef.current(); dirtyRef.current = false; }
            animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    }, [phase]);

    useEffect(() => { tapModeRef.current = tapMode; }, [tapMode]);
    useEffect(() => { selectedPaletteTileRef.current = selectedPaletteTile; }, [selectedPaletteTile]);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const handler = (e: MediaQueryListEvent) => setTapMode(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            cx: (e.clientX - rect.left) * (CANVAS_W / rect.width),
            cy: (e.clientY - rect.top) * (CANVAS_H / rect.height),
        };
    }

    const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        setScrollRow(scrollRowRef.current + Math.sign(e.deltaY));
    }, []);

    const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (tapModeRef.current) return;
        e.preventDefault();
        const { cx, cy } = getCanvasPos(e);
        const gp = pixelToGrid(cx, cy);
        if (!gp || !gridRef.current[gp.row]?.[gp.col]) return;
        const cell = gridRef.current[gp.row][gp.col]!;
        dragRef.current = { tileId: cell.tileId, cx, cy, source: { col: gp.col, row: gp.row } };
    }, []);

    const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (tapModeRef.current) { tapHoverRef.current = getCanvasPos(e); return; }
        if (!dragRef.current) return;
        e.preventDefault();
        const { cx, cy } = getCanvasPos(e);
        dragRef.current = { ...dragRef.current, cx, cy };
    }, []);

    const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        if (!drag) {
            if (tapModeRef.current && selectedPaletteTileRef.current) {
                const { cx, cy } = getCanvasPos(e);
                const gp = pixelToGrid(cx, cy);
                if (gp && !gridRef.current[gp.row]?.[gp.col]) {
                    const tileId = selectedPaletteTileRef.current;
                    gridRef.current[gp.row][gp.col] = { tileId };
                    setSelectedPaletteTile(null);
                    selectedPaletteTileRef.current = null;
                    resolveMerges();
                }
            }
            return;
        }
        dragRef.current = null;
        const { cx, cy } = getCanvasPos(e);
        const gp = pixelToGrid(cx, cy);
        if (!gp) return;
        const grid = gridRef.current;
        const dest = grid[gp.row]?.[gp.col];
        if (drag.source !== 'palette' && typeof drag.source === 'object') {
            const { col: sc, row: sr } = drag.source;
            if (sc === gp.col && sr === gp.row) return;
            grid[sr][sc] = dest ? { tileId: dest.tileId } : null;
        }
        grid[gp.row][gp.col] = { tileId: drag.tileId };
        resolveMerges();
    }, [resolveMerges]);

    const handlePaletteTap = useCallback((tileId: string) => {
        setSelectedPaletteTile(prev => {
            const next = prev === tileId ? null : tileId;
            selectedPaletteTileRef.current = next;
            return next;
        });
    }, []);

    const handlePaletteDragStart = useCallback((tileId: string, e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current!;
        const updatePos = (ev: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (!dragRef.current) return;
            dragRef.current = { ...dragRef.current, cx: (ev.clientX - rect.left) * (CANVAS_W / rect.width), cy: (ev.clientY - rect.top) * (CANVAS_H / rect.height) };
        };
        const onUp = (ev: PointerEvent) => {
            window.removeEventListener('pointermove', updatePos);
            window.removeEventListener('pointerup', onUp);
            const drag = dragRef.current;
            if (!drag) return;
            dragRef.current = null;
            const rect = canvas.getBoundingClientRect();
            const upCx = (ev.clientX - rect.left) * (CANVAS_W / rect.width);
            const upCy = (ev.clientY - rect.top) * (CANVAS_H / rect.height);
            const gp = pixelToGrid(upCx, upCy);
            if (!gp || gridRef.current[gp.row]?.[gp.col]) return;
            gridRef.current[gp.row][gp.col] = { tileId: drag.tileId };
            resolveMerges();
        };
        const rect = canvas.getBoundingClientRect();
        dragRef.current = { tileId, cx: (e.clientX - rect.left) * (CANVAS_W / rect.width), cy: (e.clientY - rect.top) * (CANVAS_H / rect.height), source: 'palette' };
        window.addEventListener('pointermove', updatePos);
        window.addEventListener('pointerup', onUp);
    }, [resolveMerges]);

    const clearBoard = useCallback(() => {
        gridRef.current = emptyGrid(); mergeAnimsRef.current = []; dragRef.current = null; dirtyRef.current = true;
    }, []);

    const startGame = useCallback(() => {
        gridRef.current = emptyGrid(); mergeAnimsRef.current = []; scoreRef.current = 0; solvedCountRef.current = 0; dragRef.current = null;
        scrollRowRef.current = 0; setScrollRowState(0);
        setScore(0); setSolvedCount(0);
        pickNewTarget();
        setPhase('playing');
    }, []);

    const saveGroups = (updated: GoalGroup[]) => {
        setGroups(updated);
        localStorage.setItem('hd-goal-groups', JSON.stringify(updated));
        if (user) saveHbGoalGroups(user.uid, updated).catch(console.warn);
    };

    const handleAddVocab = (char: string, meaning: string, translit: string, recipe?: Recipe): string => {
        const id = `hv_${Date.now()}`;
        HB_RUNTIME_TILES[id] = makeTile(id, char, meaning, hashTier(id));
        const entry: HebrewVocabEntry = { id, char, meaning, transliteration: translit };
        const full: HebrewVocabEntry = recipe && recipe.letters.length >= 2 ? { ...entry, recipe } : entry;
        if (recipe && recipe.letters.length >= 2) {
            HB_RUNTIME_MERGE_MAP.set(recipe.letters.join(','), { result: id, xp: recipe.xp });
        }
        const updated = [...vocabWordsRef.current, full];
        setVocabWords(updated);
        if (user) saveHebrewVocab(user.uid, updated).catch(console.warn);
        return id;
    };

    const handleDeleteVocab = (id: string) => {
        const entry = vocabWords.find(e => e.id === id);
        if (entry?.recipe && entry.recipe.letters.length >= 2) {
            HB_RUNTIME_MERGE_MAP.delete(entry.recipe.letters.join(','));
        }
        delete HB_RUNTIME_TILES[id];
        const updated = vocabWords.filter(e => e.id !== id);
        setVocabWords(updated);
        if (user) saveHebrewVocab(user.uid, updated).catch(console.warn);
        if (targetRef.current === id) setTimeout(() => pickNewTarget(), 50);
    };

    const handleUpdateVocab = (id: string, char: string, meaning: string, translit: string, recipe?: Recipe) => {
        const existing = vocabWords.find(e => e.id === id);
        if (existing?.recipe && existing.recipe.letters.length >= 2) {
            HB_RUNTIME_MERGE_MAP.delete(existing.recipe.letters.join(','));
        }
        HB_RUNTIME_TILES[id] = makeTile(id, char, meaning, hashTier(id));
        const entry: HebrewVocabEntry = { id, char, meaning, transliteration: translit };
        const full: HebrewVocabEntry = recipe && recipe.letters.length >= 2 ? { ...entry, recipe } : entry;
        if (recipe && recipe.letters.length >= 2) {
            HB_RUNTIME_MERGE_MAP.set(recipe.letters.join(','), { result: id, xp: recipe.xp });
        }
        const updated = vocabWords.map(e => e.id === id ? full : e);
        setVocabWords(updated);
        if (user) saveHebrewVocab(user.uid, updated).catch(console.warn);
    };

    // ── Render: charPick ──────────────────────────────────────────────────────
    if (phase === 'charPick') {
        return (
            <div className="fixed inset-0 z-50 bg-[#0d0a04] flex flex-col items-center justify-center p-6">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
                <div className="text-7xl mb-3 select-none" style={{ fontFamily: 'serif', color: '#d97706', textShadow: '0 0 30px #b45309' }}>א</div>
                <h2 className="text-2xl font-bold text-amber-200 mb-1">Hebrew Builder</h2>
                <p className="text-amber-500/70 text-sm mb-2 text-center max-w-xs">
                    {tapMode
                        ? 'Tap a letter tile, then tap the board to place it. Build words across each row, right-to-left.'
                        : 'Drag Hebrew letters onto the board row by row. Scroll down for more lines. Letters placed in sequence auto-merge into the word!'}
                </p>
                <p className="text-amber-800/60 text-xs mb-6 text-center max-w-xs">
                    Up to 7 letters per word · place RTL or LTR
                </p>
                {allCharacters.length > 0 && (
                    <>
                        <p className="text-amber-300/60 text-xs mb-3">Award XP to:</p>
                        <div className="flex flex-wrap gap-2 justify-center max-w-sm mb-6">
                            {allCharacters.map(c => (
                                <button key={c.id} onClick={() => setSelectedCharId(prev => prev === c.id ? null : c.id)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedCharId === c.id ? 'bg-amber-700/30 border-amber-500 text-amber-300' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-amber-700'}`}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                <button onClick={startGame}
                    className="px-8 py-3 bg-gradient-to-r from-amber-700 to-yellow-600 hover:from-amber-600 hover:to-yellow-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-amber-900/40 transition-all">
                    Start Building
                </button>
                {vocabWords.length === 0 && (
                    <p className="text-amber-700/70 text-xs mt-4 text-center">Add vocab words in the Goals panel after starting!</p>
                )}
            </div>
        );
    }

    // ── Render: playing ───────────────────────────────────────────────────────
    const targetDef = hbLookupTile(targetId);
    const targetEntry = vocabWords.find(w => w.id === targetId);

    return (
        <div className="fixed inset-0 z-50 bg-[#0d0a04] flex flex-col items-center overflow-hidden select-none">
            <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg z-10">✕</button>

            <div className="flex items-center gap-4 pt-3 pb-2 px-4 w-full max-w-3xl">
                <div className="text-center">
                    <div className="text-xs text-amber-800 uppercase tracking-widest">Score</div>
                    <div className="text-xl font-black text-amber-400">{score.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-amber-800 uppercase tracking-widest">Formed</div>
                    <div className="text-xl font-black text-emerald-400">{solvedCount}</div>
                </div>
                <button onClick={clearBoard} className="ml-auto text-xs px-3 py-1 bg-gray-900 hover:bg-gray-800 text-gray-400 rounded-lg border border-gray-800 transition">Clear</button>
            </div>

            <div className="flex flex-col lg:flex-row flex-1 gap-3 px-3 overflow-y-auto lg:overflow-hidden w-full max-w-3xl lg:items-start">

                <div className="flex flex-col items-center flex-shrink-0">
                    {/* Target chip */}
                    {targetDef ? (
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/80 rounded-2xl border border-amber-900/40 w-full mb-1">
                            <div className="text-xs text-amber-700 uppercase tracking-widest whitespace-nowrap">Target</div>
                            <div className="flex items-center justify-center rounded-xl font-bold flex-shrink-0"
                                style={{ width: 44, height: 44, background: targetDef.color, color: targetDef.textColor, fontSize: 18, fontFamily: 'serif', boxShadow: `0 0 18px ${targetDef.glow}88`, borderRadius: 12 }}>
                                {targetDef.char}
                            </div>
                            <div>
                                <div className="text-white font-semibold text-sm" dir="rtl" style={{ fontFamily: 'serif' }}>{targetDef.char}</div>
                                {targetEntry?.transliteration && <div className="text-amber-500/70 text-xs italic">{targetEntry.transliteration}</div>}
                                <div className="text-gray-400 text-xs leading-tight">{targetDef.meaning}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="px-4 py-2 bg-gray-900/60 rounded-2xl border border-amber-900/30 w-full mb-1 text-amber-800 text-xs">
                            Add vocab words in the Goals panel →
                        </div>
                    )}

                    {/* Canvas + scroll controls */}
                    <div className="relative flex-shrink-0">
                        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                            className="rounded-xl border border-amber-900/20 touch-none cursor-grab active:cursor-grabbing"
                            style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' }}
                            onWheel={handleWheel}
                            onPointerDown={handleCanvasPointerDown}
                            onPointerMove={handleCanvasPointerMove}
                            onPointerUp={handleCanvasPointerUp}
                            onPointerCancel={() => { dragRef.current = null; }}
                            onPointerLeave={() => { tapHoverRef.current = null; }}
                        />
                        {/* Scroll buttons (right side) */}
                        <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between py-1 -mr-7">
                            <button onClick={() => setScrollRow(scrollRowRef.current - 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-900/80 text-amber-700 hover:text-amber-400 hover:bg-gray-800 transition text-xs">▲</button>
                            <div className="text-center text-amber-900/50 text-xs" style={{ writingMode: 'vertical-rl' }}>row {scrollRow + 1}</div>
                            <button onClick={() => setScrollRow(scrollRowRef.current + 1)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-900/80 text-amber-700 hover:text-amber-400 hover:bg-gray-800 transition text-xs">▼</button>
                        </div>
                        {mergeFlash && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
                                    <div className="text-4xl font-bold" dir="rtl" style={{ fontFamily: 'serif', color: '#fde68a' }}>{mergeFlash.char}</div>
                                    <div className="text-xs text-gray-300 mt-1">{mergeFlash.meaning}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Hebrew alphabet palette */}
                    <div className="w-full mt-3">
                        <div className="text-xs text-amber-800/60 uppercase tracking-widest mb-1.5 text-center">
                            {tapMode ? 'Tap a letter · tap the board · scroll for more rows' : 'Drag letters across each row · scroll with wheel'}
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-center mb-1">
                            {STANDARD_LETTERS.map(letter => {
                                const isSelected = tapMode && selectedPaletteTile === letter.id;
                                return (
                                    <div key={letter.id}
                                        className={`flex items-center justify-center font-bold transition-all ${tapMode ? 'cursor-pointer active:scale-90' : 'cursor-grab active:cursor-grabbing hover:scale-110'}`}
                                        style={{ width: 40, height: 40, background: letter.color, color: letter.textColor, fontSize: 20, fontFamily: 'serif', borderRadius: 12, transform: isSelected ? 'scale(1.2)' : undefined, boxShadow: isSelected ? `0 0 0 3px white, 0 0 22px ${letter.glow}` : `0 0 12px ${letter.glow}80`, touchAction: 'manipulation' }}
                                        onClick={tapMode ? () => handlePaletteTap(letter.id) : undefined}
                                        onPointerDown={!tapMode ? e => handlePaletteDragStart(letter.id, e) : undefined}
                                    >
                                        {letter.char}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-center mb-1 items-center">
                            <span className="text-amber-800/50 text-xs">Finals:</span>
                            {FINAL_LETTERS.map(letter => {
                                const isSelected = tapMode && selectedPaletteTile === letter.id;
                                return (
                                    <div key={letter.id}
                                        className={`flex items-center justify-center font-bold transition-all ${tapMode ? 'cursor-pointer active:scale-90' : 'cursor-grab active:cursor-grabbing hover:scale-110'}`}
                                        style={{ width: 40, height: 40, background: letter.color, color: letter.textColor, fontSize: 20, fontFamily: 'serif', borderRadius: 12, transform: isSelected ? 'scale(1.2)' : undefined, boxShadow: isSelected ? `0 0 0 3px white, 0 0 22px ${letter.glow}` : `0 0 12px ${letter.glow}80`, touchAction: 'manipulation' }}
                                        onClick={tapMode ? () => handlePaletteTap(letter.id) : undefined}
                                        onPointerDown={!tapMode ? e => handlePaletteDragStart(letter.id, e) : undefined}
                                    >
                                        {letter.char}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-xs text-amber-900/50 text-center pb-1">
                            Letters placed consecutively in a row auto-merge when the sequence matches a recipe
                        </div>
                    </div>
                </div>

                {/* Desktop sidebar */}
                <div className={`hidden lg:flex flex-col flex-shrink-0 self-stretch overflow-hidden transition-all duration-200 ${goalListOpen ? 'w-52' : 'w-8'}`}>
                    <div className="flex items-center gap-1 pt-1 mb-1">
                        {goalListOpen && <span className="text-xs text-amber-800 uppercase tracking-widest flex-1">Vocab</span>}
                        <button onClick={() => setGoalListOpen(o => !o)} className="flex items-center justify-center w-6 h-6 rounded text-gray-600 hover:text-white hover:bg-gray-800 transition flex-shrink-0" title={goalListOpen ? 'Hide' : 'Show'}>
                            <span style={{ fontSize: 10 }}>{goalListOpen ? '▶' : '◀'}</span>
                        </button>
                    </div>
                    {goalListOpen && (
                        <HebrewGoalsPanel
                            allVocabIds={allVocabIds} targetId={targetId} groups={groups} vocabWords={vocabWords}
                            onSaveGroups={saveGroups} onAddVocab={handleAddVocab} onDeleteVocab={handleDeleteVocab} onUpdateVocab={handleUpdateVocab}
                        />
                    )}
                </div>

                {/* Mobile panel */}
                <div className="lg:hidden w-full flex-shrink-0 pb-4">
                    <button onClick={() => setGoalListOpen(o => !o)} className="flex items-center gap-2 w-full px-3 py-2 bg-gray-900/80 border border-amber-900/30 rounded-2xl text-xs text-amber-700 hover:text-amber-400 transition">
                        <span className="uppercase tracking-widest flex-1 text-left">Vocab Words</span>
                        <span style={{ fontSize: 10 }}>{goalListOpen ? '▲' : '▼'}</span>
                    </button>
                    {goalListOpen && (
                        <div className="mt-1 px-2 flex flex-col bg-gray-900/60 border border-amber-900/20 rounded-2xl pt-2 max-h-80 overflow-y-auto">
                            <HebrewGoalsPanel
                                allVocabIds={allVocabIds} targetId={targetId} groups={groups} vocabWords={vocabWords}
                                onSaveGroups={saveGroups} onAddVocab={handleAddVocab} onDeleteVocab={handleDeleteVocab} onUpdateVocab={handleUpdateVocab}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default HebrewDrop;
