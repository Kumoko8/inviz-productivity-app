/**
 * KanjiDrop — Free-play kanji building game.
 *
 * Target kanji shown at top. Player drags radical tiles from the palette
 * into the free-play canvas area. Adjacent tiles auto-merge when they
 * satisfy a recipe. Score when you form the target kanji.
 * Tiles grow with tier and render with a gooey/slime aesthetic.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { PuzzleCharacterOption } from './PuzzleMode';
import { TARGET_POOL } from './KanjiDropData';
export type { TileDef, TileDefExt } from './KanjiDropData';
import { useUser } from '../../context/UserContext';
import { loadCustomKanjis, saveCustomKanjis, loadGoalGroups, saveGoalGroups } from '../../services/kanjiDropService';
import type { CustomKanjiEntry } from '../../services/kanjiDropService';
import {
    RUNTIME_TILES, RUNTIME_MERGE_MAP, makeTile,
    type GoalGroup, type MergeAnim, type DragState, type GridCell, type GamePhase,
    DROPPABLE_IDS, COLS, ROWS, CELL, CANVAS_W, CANVAS_H,
    lookupTile, emptyGrid, resolveOnePass, drawGooeyTile,
} from './kanjidrop/kanjiDropTypes';
import CharPickScreen from './kanjidrop/CharPickScreen';
import GoalsPanel from './kanjidrop/GoalsPanel';

// ─── Tier group helpers ─────────────────────────────────────────────────────
function tierLabel(tier: number): string {
    const labels: Record<number, string> = {
        0: 'Strokes',
        1: 'Basic Parts',
        2: 'Common Radicals',
        3: 'Compound Parts',
        4: 'Complex Parts',
        5: 'Advanced',
        6: 'Expert',
        7: 'Master',
    };
    return labels[tier] ?? (tier < 0 ? 'Special' : `Tier ${tier}`);
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
    onClose: () => void;
    allCharacters?: PuzzleCharacterOption[];
    onAwardXP?: (charId: string, xp: number) => void;
}

const KanjiDrop: React.FC<Props> = ({ onClose, allCharacters = [], onAwardXP }) => {
    const { user } = useUser();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gridCanvasRef = useRef<HTMLCanvasElement | null>(null); // pre-rendered static grid
    const gridRef = useRef<(GridCell | null)[][]>(emptyGrid());
    const mergeAnimsRef = useRef<MergeAnim[]>([]);
    const dragRef = useRef<DragState | null>(null);
    const scoreRef = useRef<number>(0);
    const targetRef = useRef<string>(TARGET_POOL[0]);
    const solvedCountRef = useRef<number>(0);

    const [phase, setPhase] = useState<GamePhase>('charPick');
    const [score, setScore] = useState(0);
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    const [targetId, setTargetId] = useState<string>(TARGET_POOL[0]);
    const [solvedCount, setSolvedCount] = useState(0);
    const [mergeFlash, setMergeFlash] = useState<{ char: string; meaning: string } | null>(null);

    const [goalListOpen, setGoalListOpen] = useState(true);
    const [groups, setGroups] = useState<GoalGroup[]>(() => {
        try { const s = localStorage.getItem('kd-goal-groups'); return s ? JSON.parse(s) : []; } catch { return []; }
    });
    const [tapMode, setTapMode] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
    );
    const [selectedPaletteTile, setSelectedPaletteTile] = useState<string | null>(null);
    const tapModeRef = useRef(false);
    const selectedPaletteTileRef = useRef<string | null>(null);
    const tapHoverRef = useRef<{ cx: number; cy: number } | null>(null);

    const [customKanjis, setCustomKanjis] = useState<CustomKanjiEntry[]>([]);

    const [poolPickerOpen, setPoolPickerOpen] = useState(false);
    const [activeGroups, setActiveGroups] = useState<Set<number>>(() => {
        try {
            const s = localStorage.getItem('kd-active-groups');
            if (s) return new Set(JSON.parse(s) as number[]);
        } catch { /* ignore */ }
        const tiers = new Set<number>();
        for (const id of TARGET_POOL) {
            const def = lookupTile(id);
            tiers.add(def?.tier ?? -1);
        }
        return tiers;
    });

    const allTargetPool = useMemo(
        () => [...TARGET_POOL, ...customKanjis.map(t => t.id)],
        [customKanjis]
    );
    const allTargetPoolRef = useRef(allTargetPool);
    allTargetPoolRef.current = allTargetPool;

    const tierGroups = useMemo(() => {
        const map = new Map<number, string[]>();
        for (const id of allTargetPool) {
            const def = lookupTile(id);
            const tier = def?.tier ?? -1;
            if (!map.has(tier)) map.set(tier, []);
            map.get(tier)!.push(id);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a - b);
    }, [allTargetPool]);

    const activeTargetPool = useMemo(() => {
        const filtered = allTargetPool.filter(id => {
            const def = lookupTile(id);
            return activeGroups.has(def?.tier ?? -1);
        });
        return filtered.length > 0 ? filtered : allTargetPool;
    }, [allTargetPool, activeGroups]);
    const activeTargetPoolRef = useRef(activeTargetPool);
    activeTargetPoolRef.current = activeTargetPool;

    // Deck for draw-without-replacement. Refilled (reshuffled) when empty.
    const deckRef = useRef<string[]>([]);

    // Reset deck whenever active groups change so the next draw picks from the new pool.
    useEffect(() => { deckRef.current = []; }, [activeGroups]);

    const drawRef = useRef<() => void>(() => { });
    // Dirty flag — draw() only runs when something has changed.
    // Set true by anything that mutates visible state; the rAF loop clears it after each draw.
    const dirtyRef = useRef(true);

    // ─── Load user custom kanjis from Firestore when user is known ──────────
    useEffect(() => {
        if (!user) return;
        loadCustomKanjis(user.uid).then(entries => {
            entries.forEach(entry => {
                RUNTIME_TILES[entry.id] = makeTile(entry.id, entry.char, entry.meaning, entry.tier);
                if (entry.recipe) {
                    const { a, b, c, d, xp } = entry.recipe;
                    const required = [b, c, d].filter(x => x !== '').sort();
                    RUNTIME_MERGE_MAP.set(`${a}|${required.join(',')}`, { result: entry.id, xp });
                }
            });
            setCustomKanjis(entries);
        }).catch(err => {
            console.warn('Could not load custom kanjis:', err);
        });
    }, [user?.uid]);

    // ─── Load goal groups from Firestore (overrides localStorage) ───────────
    useEffect(() => {
        if (!user) return;
        loadGoalGroups(user.uid).then(firestoreGroups => {
            if (firestoreGroups.length > 0) {
                setGroups(firestoreGroups);
                localStorage.setItem('kd-goal-groups', JSON.stringify(firestoreGroups));
            }
        }).catch(err => {
            console.warn('Could not load goal groups:', err);
        });
    }, [user?.uid]);

    function pickNewTarget() {
        const pool = activeTargetPoolRef.current;
        if (deckRef.current.length === 0) {
            // Refill and Fisher-Yates shuffle
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

    function pixelToGrid(x: number, y: number): { col: number; row: number } | null {
        const col = Math.floor(x / CELL);
        const row = Math.floor(y / CELL);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
        return { col, row };
    }

    function cellCenter(col: number, row: number) {
        return { cx: col * CELL + CELL / 2, cy: row * CELL + CELL / 2 };
    }

    const resolveMerges = useCallback(() => {
        dirtyRef.current = true; // grid will change — redraw needed
        const grid = gridRef.current;
        const now = performance.now();
        let timeOffset = 0;
        let s = ROWS * COLS * 3;
        let pass;
        let earned = 0;

        while ((pass = resolveOnePass(grid)) !== null && s-- > 0) {
            if (!lookupTile(pass.resultId)) { grid[pass.row][pass.col] = null; break; }
            const { col: mc, row: mr, resultId, xp, absorbedCells } = pass;

            for (const [nc, nr] of absorbedCells) {
                const absDef = lookupTile(grid[nr][nc]!.tileId);
                if (absDef) {
                    const { cx, cy } = cellCenter(nc, nr);
                    mergeAnimsRef.current.push({
                        type: 'absorbed', x: cx, y: cy,
                        color: absDef.color, textColor: absDef.textColor, glow: absDef.glow, char: absDef.char,
                        startTime: now + timeOffset, dur: 550,
                    });
                }
                grid[nr][nc] = null;
            }
            grid[mr][mc] = { tileId: resultId };
            const resDef = lookupTile(resultId);
            earned += xp * absorbedCells.length;
            if (resDef) {
                const { cx, cy } = cellCenter(mc, mr);
                mergeAnimsRef.current.push({
                    type: 'pulse', x: cx, y: cy,
                    color: resDef.glow, textColor: resDef.textColor, glow: resDef.glow, char: resDef.char,
                    startTime: now + timeOffset, dur: 550,
                });
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

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Draw pre-rendered grid lines in one call instead of many beginPath/stroke calls
        if (gridCanvasRef.current) {
            ctx.drawImage(gridCanvasRef.current, 0, 0);
        }

        if (dragRef.current) {
            const gp = pixelToGrid(dragRef.current.cx, dragRef.current.cy);
            if (gp) {
                ctx.fillStyle = 'rgba(255,255,255,0.07)';
                ctx.beginPath();
                ctx.roundRect(gp.col * CELL + 3, gp.row * CELL + 3, CELL - 6, CELL - 6, 12);
                ctx.fill();
            }
        } else if (tapHoverRef.current && selectedPaletteTileRef.current) {
            const gp = pixelToGrid(tapHoverRef.current.cx, tapHoverRef.current.cy);
            if (gp && !gridRef.current[gp.row][gp.col]) {
                const hDef = lookupTile(selectedPaletteTileRef.current!);
                ctx.fillStyle = hDef ? hDef.glow + '33' : 'rgba(255,255,255,0.07)';
                ctx.beginPath();
                ctx.roundRect(gp.col * CELL + 3, gp.row * CELL + 3, CELL - 6, CELL - 6, 12);
                ctx.fill();
            }
        }

        const grid = gridRef.current;
        const drag = dragRef.current;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                if (!cell) continue;
                if (drag?.source !== 'palette' &&
                    typeof drag?.source === 'object' &&
                    drag.source.col === c && drag.source.row === r) continue;
                const { cx, cy } = cellCenter(c, r);
                drawGooeyTile(ctx, cx, cy, cell.tileId);
            }
        }

        mergeAnimsRef.current = mergeAnimsRef.current.filter(anim => {
            const elapsed = now - anim.startTime;
            if (elapsed < 0) return true;
            const t = Math.min(elapsed / anim.dur, 1);
            if (t >= 1) return false;

            if (anim.type === 'absorbed') {
                const s = (CELL * 0.88) * (1 - t * 0.85);
                const r2 = s * 0.38;
                ctx.save();
                ctx.globalAlpha = 1 - t;
                // Fake glow instead of shadowBlur
                const gs = s + 8;
                ctx.fillStyle = anim.glow;
                ctx.globalAlpha = (1 - t) * 0.3;
                ctx.beginPath();
                ctx.roundRect(anim.x - gs / 2, anim.y - gs / 2, gs, gs, gs * 0.38);
                ctx.fill();
                ctx.globalAlpha = 1 - t;
                ctx.fillStyle = anim.color;
                ctx.beginPath();
                ctx.roundRect(anim.x - s / 2, anim.y - s / 2, s, s, r2);
                ctx.fill();
                ctx.fillStyle = anim.textColor;
                ctx.font = `bold ${Math.round(s * 0.44)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(anim.char, anim.x, anim.y + 1);
                ctx.restore();
            } else {
                for (let i = 0; i < 3; i++) {
                    const delay = i * 0.15;
                    const rt = Math.max(0, Math.min((t - delay) / (1 - delay), 1));
                    if (rt <= 0) continue;
                    const expand = rt * CELL * 1.1;
                    ctx.save();
                    ctx.globalAlpha = (1 - rt) * 0.7;
                    ctx.strokeStyle = anim.glow;
                    ctx.lineWidth = 4 - i;
                    ctx.beginPath();
                    ctx.roundRect(
                        anim.x - CELL / 2 - expand / 2,
                        anim.y - CELL / 2 - expand / 2,
                        CELL + expand, CELL + expand,
                        (CELL / 2 + expand / 2) * 0.4
                    );
                    ctx.stroke();
                    ctx.restore();
                }
            }
            return true;
        });

        if (drag) {
            drawGooeyTile(ctx, drag.cx, drag.cy, drag.tileId, 0.88, 1.12);
        }
    }, []);

    useEffect(() => { drawRef.current = draw; }, [draw]);

    // Pre-render the static grid lines once to an offscreen canvas.
    useEffect(() => {
        const offscreen = document.createElement('canvas');
        offscreen.width = CANVAS_W;
        offscreen.height = CANVAS_H;
        const octx = offscreen.getContext('2d')!;
        octx.strokeStyle = 'rgba(255,255,255,0.04)';
        octx.lineWidth = 1;
        for (let c = 0; c <= COLS; c++) {
            octx.beginPath(); octx.moveTo(c * CELL, 0); octx.lineTo(c * CELL, CANVAS_H); octx.stroke();
        }
        for (let r = 0; r <= ROWS; r++) {
            octx.beginPath(); octx.moveTo(0, r * CELL); octx.lineTo(CANVAS_W, r * CELL); octx.stroke();
        }
        gridCanvasRef.current = offscreen;
        dirtyRef.current = true;
    }, []);

    useEffect(() => {
        if (phase !== 'playing') return;
        dirtyRef.current = true;
        let animId: number;
        const loop = () => {
            // Only call the expensive draw() when something has actually changed.
            // hasDrag / hasAnims / hasTapHover keep the loop drawing continuously
            // during interactions; otherwise the canvas is skipped entirely.
            const hasDrag = dragRef.current !== null;
            const hasAnims = mergeAnimsRef.current.length > 0;
            const hasTapHover = tapHoverRef.current !== null && selectedPaletteTileRef.current !== null;
            if (dirtyRef.current || hasDrag || hasAnims || hasTapHover) {
                drawRef.current();
                dirtyRef.current = false;
            }
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

    const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;
        return {
            cx: (e.clientX - rect.left) * scaleX,
            cy: (e.clientY - rect.top) * scaleY,
        };
    };

    const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const { cx, cy } = getCanvasPos(e);
        const gp = pixelToGrid(cx, cy);
        if (!gp) return;
        const cell = gridRef.current[gp.row][gp.col];
        if (!cell) return;
        // Picking up a board tile cancels any selected palette tile
        setSelectedPaletteTile(null);
        selectedPaletteTileRef.current = null;
        dragRef.current = { tileId: cell.tileId, cx, cy, source: { col: gp.col, row: gp.row } };
    }, []);

    const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const { cx, cy } = getCanvasPos(e);
        if (dragRef.current) {
            dragRef.current = { ...dragRef.current, cx, cy };
        } else if (tapModeRef.current) {
            tapHoverRef.current = { cx, cy };
        }
    }, []);

    const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;

        if (!drag) {
            // Tap-to-place: no board drag active — place selected palette tile
            if (tapModeRef.current && selectedPaletteTileRef.current) {
                const { cx, cy } = getCanvasPos(e);
                const gp = pixelToGrid(cx, cy);
                if (gp && !gridRef.current[gp.row][gp.col]) {
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
        const dest = grid[gp.row][gp.col];

        if (drag.source !== 'palette' && typeof drag.source === 'object') {
            const { col: sc, row: sr } = drag.source;
            if (sc === gp.col && sr === gp.row) return;
            grid[sr][sc] = dest ? { tileId: dest.tileId } : null;
        }

        grid[gp.row][gp.col] = { tileId: drag.tileId };
        resolveMerges();
    }, [resolveMerges]);

    const handlePaletteDragStart = useCallback((tileId: string, e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();

        const canvas = canvasRef.current!;
        const updatePos = (ev: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            if (!dragRef.current) return;
            dragRef.current = {
                ...dragRef.current,
                cx: (ev.clientX - rect.left) * (CANVAS_W / rect.width),
                cy: (ev.clientY - rect.top) * (CANVAS_H / rect.height),
            };
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
            if (!gp || gridRef.current[gp.row][gp.col]) return;

            gridRef.current[gp.row][gp.col] = { tileId: drag.tileId };
            resolveMerges();
        };

        const rect = canvas.getBoundingClientRect();
        dragRef.current = {
            tileId,
            cx: (e.clientX - rect.left) * (CANVAS_W / rect.width),
            cy: (e.clientY - rect.top) * (CANVAS_H / rect.height),
            source: 'palette',
        };
        window.addEventListener('pointermove', updatePos);
        window.addEventListener('pointerup', onUp);
    }, [resolveMerges]);

    const handlePaletteTap = useCallback((tileId: string) => {
        setSelectedPaletteTile(prev => {
            const next = prev === tileId ? null : tileId;
            selectedPaletteTileRef.current = next;
            return next;
        });
    }, []);

    const clearBoard = useCallback(() => {
        gridRef.current = emptyGrid();
        mergeAnimsRef.current = [];
        dragRef.current = null;
        dirtyRef.current = true;
    }, []);

    const startGame = useCallback(() => {
        gridRef.current = emptyGrid();
        mergeAnimsRef.current = [];
        scoreRef.current = 0;
        solvedCountRef.current = 0;
        dragRef.current = null;
        setScore(0);
        setSolvedCount(0);
        pickNewTarget();
        setPhase('playing');
    }, []);

    // ─── charPick screen ──────────────────────────────────────────────────────
    if (phase === 'charPick') {
        return (
            <CharPickScreen
                tapMode={tapMode}
                allCharacters={allCharacters}
                selectedCharId={selectedCharId}
                onSelectChar={setSelectedCharId}
                onStart={startGame}
                onClose={onClose}
            />
        );
    }

    // ─── Persistence callbacks for GoalsPanel ─────────────────────────────────
    const saveGroups = (updated: GoalGroup[]) => {
        setGroups(updated);
        localStorage.setItem('kd-goal-groups', JSON.stringify(updated));
        if (user) saveGoalGroups(user.uid, updated).catch(console.warn);
    };

    const handleAddCustomKanji = (char: string, meaning: string, tier: number, recipe?: { a: string; b: string; c: string; d: string; xp: number }): string => {
        const id = `custom_${Date.now()}`;
        RUNTIME_TILES[id] = makeTile(id, char, meaning, tier);
        let entry: CustomKanjiEntry = { id, char, meaning, tier };
        if (recipe && recipe.a) {
            const { a, b, c, d, xp } = recipe;
            entry = { ...entry, recipe: { a, b, c, d, xp } };
            const required = [b, c, d].filter(x => x !== '').sort();
            RUNTIME_MERGE_MAP.set(`${a}|${required.join(',')}`, { result: id, xp });
        }
        const updated = [...customKanjis, entry];
        setCustomKanjis(updated);
        if (user) saveCustomKanjis(user.uid, updated).catch(console.warn);
        return id;
    };

    const handleDeleteCustomKanji = (id: string) => {
        const entry = customKanjis.find(e => e.id === id);
        if (entry?.recipe) {
            const { a, b, c, d } = entry.recipe;
            const required = [b, c, d].filter(x => x !== '').sort();
            RUNTIME_MERGE_MAP.delete(`${a}|${required.join(',')}`);
        }
        delete RUNTIME_TILES[id];
        const updated = customKanjis.filter(t => t.id !== id);
        setCustomKanjis(updated);
        if (user) saveCustomKanjis(user.uid, updated).catch(console.warn);
        if (targetRef.current === id) {
            const newPool = [...TARGET_POOL, ...updated.map(t => t.id)];
            const newId = newPool[Math.floor(Math.random() * newPool.length)];
            targetRef.current = newId;
            setTargetId(newId);
        }
    };

    const handleUpdateCustomKanji = (id: string, char: string, meaning: string, tier: number, recipe?: { a: string; b: string; c: string; d: string; xp: number }) => {
        const existing = customKanjis.find(e => e.id === id);
        if (existing?.recipe?.a) {
            const { a, b, c, d } = existing.recipe;
            const required = [b, c, d].filter(x => x !== '').sort();
            RUNTIME_MERGE_MAP.delete(`${a}|${required.join(',')}`);
        }
        RUNTIME_TILES[id] = makeTile(id, char, meaning, tier);
        let entry: CustomKanjiEntry = { id, char, meaning, tier };
        if (recipe && recipe.a) {
            const { a, b, c, d, xp } = recipe;
            entry = { ...entry, recipe: { a, b, c, d, xp } };
            const required = [b, c, d].filter(x => x !== '').sort();
            RUNTIME_MERGE_MAP.set(`${a}|${required.join(',')}`, { result: id, xp });
        }
        const updated = customKanjis.map(e => e.id === id ? entry : e);
        setCustomKanjis(updated);
        if (user) saveCustomKanjis(user.uid, updated).catch(console.warn);
    };

    // ─── playing screen ───────────────────────────────────────────────────────
    const targetDef = lookupTile(targetId);

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center overflow-hidden select-none">
            <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg z-10">✕</button>

            {/* Top bar */}
            <div className="flex items-center gap-4 pt-3 pb-2 px-4 w-full max-w-3xl">
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Score</div>
                    <div className="text-xl font-black text-yellow-400">{score.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Formed</div>
                    <div className="text-xl font-black text-emerald-400">{solvedCount}</div>
                </div>
                <button
                    onClick={clearBoard}
                    className="ml-auto text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition"
                >
                    Clear
                </button>
            </div>

            {/* Main play area: flex-col on mobile, flex-row on desktop */}
            <div className="flex flex-col lg:flex-row flex-1 gap-3 px-3 overflow-y-auto lg:overflow-hidden w-full max-w-3xl lg:items-start">

                {/* Left column: target chip + canvas + palette */}
                <div className="flex flex-col items-center flex-shrink-0">

                    {/* Target chip */}
                    {targetDef && (
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/80 rounded-2xl border border-gray-700 w-full">
                            <button
                                onClick={() => setPoolPickerOpen(o => !o)}
                                className="text-xs text-gray-400 hover:text-white uppercase tracking-widest whitespace-nowrap transition-colors flex items-center gap-1"
                                title="Edit target pool groups"
                            >
                                Target
                                <span className="opacity-50" style={{ fontSize: 9 }}>{poolPickerOpen ? '▲' : '▼'}</span>
                            </button>
                            <div
                                className="flex items-center justify-center rounded-xl font-bold"
                                style={{
                                    width: 40, height: 40, flexShrink: 0,
                                    background: targetDef.color, color: targetDef.textColor,
                                    fontSize: 22, fontFamily: 'serif',
                                    boxShadow: `0 0 18px ${targetDef.glow}88`,
                                    borderRadius: 12,
                                }}
                            >
                                {targetDef.char}
                            </div>
                            <div>
                                <div className="text-white font-semibold text-sm">{targetDef.char}</div>
                                <div className="text-gray-400 text-xs leading-tight">{targetDef.meaning}</div>
                            </div>
                        </div>
                    )}

                    {/* Target pool group picker */}
                    {poolPickerOpen && (
                        <div className="w-full mt-1 mb-1 bg-gray-900 border border-gray-700 rounded-2xl p-3">
                            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">Target Pool Groups</div>
                            <div className="flex flex-col gap-1.5">
                                {tierGroups.map(([tier, ids]) => {
                                    const isActive = activeGroups.has(tier);
                                    return (
                                        <button
                                            key={tier}
                                            onClick={() => {
                                                setActiveGroups(prev => {
                                                    const next = new Set(prev);
                                                    if (isActive) next.delete(tier); else next.add(tier);
                                                    localStorage.setItem('kd-active-groups', JSON.stringify([...next]));
                                                    return next;
                                                });
                                            }}
                                            className={`flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs transition-colors ${isActive
                                                ? 'bg-blue-900/40 border-blue-600 text-blue-200'
                                                : 'bg-gray-800 border-gray-700 text-gray-500'
                                                }`}
                                        >
                                            <span>{tierLabel(tier)}</span>
                                            <span className="opacity-50">{ids.length}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {!tierGroups.some(([tier]) => activeGroups.has(tier)) && (
                                <div className="text-xs text-amber-400 mt-2 text-center">No groups selected — using all targets</div>
                            )}
                        </div>
                    )}

                    {/* Canvas */}
                    <div className="relative flex-shrink-0">
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            className="rounded-xl border border-gray-800 touch-none cursor-grab active:cursor-grabbing"
                            style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' }}
                            onPointerDown={handleCanvasPointerDown}
                            onPointerMove={handleCanvasPointerMove}
                            onPointerUp={handleCanvasPointerUp}
                            onPointerCancel={() => { dragRef.current = null; }}
                            onPointerLeave={() => { tapHoverRef.current = null; }}
                        />
                        {mergeFlash && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <div className="bg-black/75 backdrop-blur-sm rounded-2xl px-5 py-3 text-center">
                                    <div className="text-4xl font-bold" style={{ fontFamily: 'serif', color: '#fde68a' }}>
                                        {mergeFlash.char}
                                    </div>
                                    <div className="text-xs text-gray-300 mt-1">{mergeFlash.meaning}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Radical palette */}
                    <div className="w-full mt-2">
                        <div className="text-xs text-gray-600 uppercase tracking-widest mb-1.5 text-center">
                            {tapMode ? 'Tap a radical, then tap the board to place it' : 'Drag radicals onto the board'}
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center pb-1">
                            {DROPPABLE_IDS.map(id => {
                                const def = lookupTile(id);
                                if (!def) return null;
                                const isSelected = tapMode && selectedPaletteTile === id;
                                return (
                                    <div key={id} className="relative flex flex-col items-center">
                                        <div
                                            className={`flex items-center justify-center font-bold transition-all ${tapMode
                                                    ? 'cursor-pointer active:scale-90'
                                                    : 'cursor-grab active:cursor-grabbing hover:scale-110'
                                                }`}
                                            style={{
                                                width: 44, height: 44,
                                                background: def.color, color: def.textColor,
                                                fontSize: 20, fontFamily: 'serif',
                                                borderRadius: 14,
                                                transform: isSelected ? 'scale(1.2)' : undefined,
                                                boxShadow: isSelected
                                                    ? `0 0 0 3px white, 0 0 22px ${def.glow}`
                                                    : `0 0 14px ${def.glow}99`,
                                                transition: 'transform 0.15s, box-shadow 0.15s',
                                            }}
                                            onClick={tapMode ? () => handlePaletteTap(id) : undefined}
                                            onPointerDown={!tapMode ? (e) => handlePaletteDragStart(id, e) : undefined}
                                        >
                                            {def.char}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-xs text-gray-700 text-center pb-2">
                            {tapMode ? 'Drag tiles on the board to reposition and merge them' : 'Tiles auto-merge when placed next to compatible radicals'}
                        </div>
                    </div>
                </div>

                {/* Desktop sidebar — right column (lg+) */}
                <div className={`hidden lg:flex flex-col flex-shrink-0 self-stretch overflow-hidden transition-all duration-200 ${goalListOpen ? 'w-44' : 'w-8'}`}>
                    <div className="flex items-center gap-1 pt-1 mb-1">
                        {goalListOpen && (
                            <span className="text-xs text-gray-600 uppercase tracking-widest flex-1">Goals</span>
                        )}
                        <button
                            onClick={() => setGoalListOpen(o => !o)}
                            className="flex items-center justify-center w-6 h-6 rounded text-gray-500 hover:text-white hover:bg-gray-800 transition flex-shrink-0"
                            title={goalListOpen ? 'Hide goals' : 'Show goals'}
                        >
                            <span style={{ fontSize: 10 }}>{goalListOpen ? '▶' : '◀'}</span>
                        </button>
                    </div>
                    {goalListOpen && (
                        <GoalsPanel
                            allTargetPool={allTargetPool}
                            targetId={targetId}
                            groups={groups}
                            customKanjis={customKanjis}
                            onSaveGroups={saveGroups}
                            onAddCustomKanji={handleAddCustomKanji}
                            onDeleteCustomKanji={handleDeleteCustomKanji}
                            onUpdateCustomKanji={handleUpdateCustomKanji}
                        />
                    )}
                </div>

                {/* Mobile panel — below board (< lg), scrolls as part of page */}
                <div className="lg:hidden w-full flex-shrink-0 pb-4">
                    <button
                        onClick={() => setGoalListOpen(o => !o)}
                        className="flex items-center gap-2 w-full px-3 py-2 bg-gray-900/80 border border-gray-700 rounded-2xl text-xs text-gray-400 hover:text-white transition"
                    >
                        <span className="text-gray-600 uppercase tracking-widest flex-1 text-left">Goals</span>
                        <span style={{ fontSize: 10 }}>{goalListOpen ? '▲' : '▼'}</span>
                    </button>
                    {goalListOpen && (
                        <div className="mt-1 px-2 flex flex-col bg-gray-900/60 border border-gray-800 rounded-2xl pt-2">
                            <GoalsPanel
                                allTargetPool={allTargetPool}
                                targetId={targetId}
                                groups={groups}
                                customKanjis={customKanjis}
                                onSaveGroups={saveGroups}
                                onAddCustomKanji={handleAddCustomKanji}
                                onDeleteCustomKanji={handleDeleteCustomKanji}
                                onUpdateCustomKanji={handleUpdateCustomKanji}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default KanjiDrop;
