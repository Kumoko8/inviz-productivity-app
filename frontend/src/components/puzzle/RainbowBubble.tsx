/**
 * RainbowBubble — a free-form merge puzzle where the player creates everything.
 *
 * Tiles are drawn on a pixel canvas, recipes combine tiles, and nothing is hardcoded.
 * Tap a tile in the palette, then tap the board to place it. When a placed tile touches
 * the ingredients of one of your recipes, they merge into the recipe's result.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '../../context/UserContext';
import { loadBubbleData, saveBubbleData } from '../../services/rainbowBubbleService';
import PixelEditorTilesPanel from './rainbowbubble/TilesPanel';
import RecipesPanel from './rainbowbubble/RecipesPanel';
import { RecipeView, TileChip, TileSprite } from './rainbowbubble/BubbleParts';
import {
    CANVAS_H, CANVAS_W, CELL, COLS, ROWS,
    buildRecipeMap, drawBubble, emptyGrid, resolveBoard, sectionTiles, newId,
    type BubbleGroup, type BubbleGrid, type BubbleRecipe, type BubbleTile, type MergeStep,
} from './rainbowbubble/rainbowBubbleTypes';

interface Props {
    onClose: () => void;
}

type Tab = 'play' | 'tiles' | 'recipes';

// Merge animation timing (ms): show the separate bubbles, slide them together, then reveal the result.
const HOLD_MS = 700;
const JOIN_MS = 900;
const REVEAL_MS = 600;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

function drawBoardBase(
    ctx: CanvasRenderingContext2D,
    grid: BubbleGrid,
    tileMap: Record<string, BubbleTile>,
    skip?: Set<string>,
) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, CANVAS_H); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(CANVAS_W, r * CELL); ctx.stroke(); }
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (skip?.has(`${c},${r}`)) continue;
            const t = grid[r][c] ? tileMap[grid[r][c]!] : null;
            if (t) drawBubble(ctx, c * CELL + CELL / 2, r * CELL + CELL / 2, CELL - 6, t.pixels);
        }
    }
}

function drawMergeFrame(
    ctx: CanvasRenderingContext2D,
    step: MergeStep,
    t: number,
    tileMap: Record<string, BubbleTile>,
) {
    const S = CELL - 6;
    const center = (c: number, r: number): [number, number] => [c * CELL + CELL / 2, r * CELL + CELL / 2];
    const [ax, ay] = center(step.col, step.row);
    const parts: [number, number][] = [[step.col, step.row], ...step.absorbed];
    drawBoardBase(ctx, step.before, tileMap, new Set(parts.map(([c, r]) => `${c},${r}`)));

    if (t >= HOLD_MS + JOIN_MS) {
        const q = clamp01((t - HOLD_MS - JOIN_MS) / REVEAL_MS);
        const result = tileMap[step.result];
        if (result) drawBubble(ctx, ax, ay, S * Math.max(0.1, easeOutBack(0.4 + 0.6 * q)), result.pixels);
        ctx.save();
        ctx.globalAlpha = 1 - q;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 4 * (1 - q) + 1;
        ctx.beginPath();
        ctx.arc(ax, ay, S / 2 + q * CELL * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
    }

    const p = clamp01((t - HOLD_MS) / JOIN_MS);
    const e = easeInOut(p);
    const pulse = t < HOLD_MS ? 1 + 0.04 * Math.sin(t / 90) : 1;

    if (t < HOLD_MS) {
        ctx.save();
        ctx.strokeStyle = 'rgba(253,224,71,0.8)';
        ctx.lineWidth = 2;
        for (const [c, r] of parts) {
            const [x, y] = center(c, r);
            ctx.beginPath();
            ctx.arc(x, y, S / 2 + 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    // Gooey bridge between the anchor and each absorbed bubble as they slide together.
    const moved = step.absorbed.map(([c, r]) => {
        const [x, y] = center(c, r);
        return { c, r, x: x + (ax - x) * e, y: y + (ay - y) * e, id: step.before[r][c]! };
    });
    if (p > 0) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(196,181,253,0.35)';
        for (const m of moved) {
            ctx.lineWidth = S * 0.45 * (1 - e) + 4;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
        }
        ctx.restore();
    }
    for (const m of moved) {
        const tile = tileMap[m.id];
        if (tile) drawBubble(ctx, m.x, m.y, S * (1 - 0.1 * e), tile.pixels);
    }
    const anchor = tileMap[step.before[step.row][step.col]!];
    if (anchor) drawBubble(ctx, ax, ay, S * pulse * (1 + 0.15 * e), anchor.pixels);
}

const RainbowBubble: React.FC<Props> = ({ onClose }) => {
    const { user } = useUser();
    const uid = user?.uid ?? null;

    const [tiles, setTiles] = useState<BubbleTile[]>([]);
    const [recipes, setRecipes] = useState<BubbleRecipe[]>([]);
    const [groups, setGroups] = useState<BubbleGroup[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [tab, setTab] = useState<Tab>('play');

    const [grid, setGrid] = useState<BubbleGrid>(emptyGrid);
    const [score, setScore] = useState(0);
    const [discovered, setDiscovered] = useState<Set<string>>(new Set());
    const [paletteId, setPaletteId] = useState<string | null>(null);
    const [movingCell, setMovingCell] = useState<{ col: number; row: number } | null>(null);
    const [eraseMode, setEraseMode] = useState(false);
    const [inspectId, setInspectId] = useState<string | null>(null);
    const [flash, setFlash] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const flashTimer = useRef<number | undefined>(undefined);
    const rafRef = useRef<number | undefined>(undefined);

    const tileMap = useMemo(() => Object.fromEntries(tiles.map(t => [t.id, t])) as Record<string, BubbleTile>, [tiles]);
    const recipeMap = useMemo(() => buildRecipeMap(recipes), [recipes]);
    const spawnable = useMemo(() => tiles.filter(t => t.spawnable), [tiles]);
    const paletteSections = useMemo(() => sectionTiles(spawnable, groups), [spawnable, groups]);
    const resultIds = useMemo(() => new Set(recipes.map(r => r.result)), [recipes]);

    // ─── Persistence ──────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        loadBubbleData(uid)
            .then(d => {
                if (cancelled) return;
                setTiles(d.tiles);
                setRecipes(d.recipes);
                setGroups(d.groups);
                if (d.tiles.length === 0) setTab('tiles');
            })
            .catch(err => console.warn('Could not load Rainbow Bubble data:', err))
            .finally(() => { if (!cancelled) setLoaded(true); });
        return () => { cancelled = true; };
    }, [uid]);

    useEffect(() => {
        if (!loaded) return;
        const t = window.setTimeout(() => {
            saveBubbleData(uid, { tiles, recipes, groups }).catch(err => console.warn('Could not save Rainbow Bubble data:', err));
        }, 600);
        return () => window.clearTimeout(t);
    }, [tiles, recipes, groups, loaded, uid]);

    // Drop board tiles / selections whose tile was deleted.
    useEffect(() => {
        if (!loaded) return;
        setGrid(g => {
            if (!g.some(row => row.some(id => id && !tileMap[id]))) return g;
            return g.map(row => row.map(id => (id && tileMap[id] ? id : null)));
        });
        setPaletteId(p => (p && tileMap[p] ? p : null));
        setInspectId(p => (p && tileMap[p] ? p : null));
    }, [tileMap, loaded]);

    // ─── Board drawing ────────────────────────────────────────────────────────
    useEffect(() => {
        if (tab !== 'play' || busy) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        drawBoardBase(ctx, grid, tileMap);
        if (movingCell) {
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(movingCell.col * CELL + 2, movingCell.row * CELL + 2, CELL - 4, CELL - 4);
            ctx.setLineDash([]);
        }
    }, [grid, tileMap, movingCell, tab, busy]);

    // ─── Game actions ─────────────────────────────────────────────────────────
    const showFlash = useCallback((msg: string) => {
        setFlash(msg);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), 1800);
    }, []);

    useEffect(() => () => window.clearTimeout(flashTimer.current), []);

    useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

    const applyBoard = useCallback((next: BubbleGrid) => {
        const out = resolveBoard(next, recipeMap);
        if (out.steps.length === 0) {
            setGrid(out.grid);
            return;
        }
        setGrid(next);
        setBusy(true);
        let idx = 0;
        let start = performance.now();
        const total = HOLD_MS + JOIN_MS + REVEAL_MS;
        const frame = (now: number) => {
            const step = out.steps[idx];
            const elapsed = now - start;
            if (elapsed >= total) {
                setGrid(step.after);
                setScore(s => s + step.xp);
                setDiscovered(d => new Set([...d, step.result]));
                idx++;
                if (idx >= out.steps.length) {
                    setBusy(false);
                    rafRef.current = undefined;
                    const last = tileMap[out.results[out.results.length - 1]];
                    if (last) showFlash(`${last.name}!  +${out.xp}xp`);
                    return;
                }
                start = now;
            }
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) drawMergeFrame(ctx, out.steps[idx], now - start, tileMap);
            rafRef.current = requestAnimationFrame(frame);
        };
        rafRef.current = requestAnimationFrame(frame);
    }, [recipeMap, tileMap, showFlash]);

    const handleBoardPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (busy) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
        const row = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
        const here = grid[row][col];
        if (here) setInspectId(here);

        if (eraseMode) {
            if (!here) return;
            const next = grid.map(r => [...r]);
            next[row][col] = null;
            setGrid(next);
            return;
        }
        if (paletteId) {
            if (here) return;
            const next = grid.map(r => [...r]);
            next[row][col] = paletteId;
            applyBoard(next);
            return;
        }
        if (movingCell) {
            const { col: sc, row: sr } = movingCell;
            setMovingCell(null);
            if (sc === col && sr === row) return;
            const next = grid.map(r => [...r]);
            next[row][col] = grid[sr][sc];
            next[sr][sc] = here;
            applyBoard(next);
            return;
        }
        if (here) setMovingCell({ col, row });
    };

    const selectPalette = (id: string) => {
        setPaletteId(p => (p === id ? null : id));
        setEraseMode(false);
        setMovingCell(null);
        setInspectId(id);
    };

    const clearBoard = () => { if (busy) return; setGrid(emptyGrid()); setMovingCell(null); };

    // ─── Editing ──────────────────────────────────────────────────────────────
    const saveTile = (tile: BubbleTile) =>
        setTiles(ts => (ts.some(t => t.id === tile.id) ? ts.map(t => (t.id === tile.id ? tile : t)) : [...ts, tile]));

    const deleteTile = (id: string) => {
        setTiles(ts => ts.filter(t => t.id !== id));
        setRecipes(rs => rs.filter(r => r.a !== id && r.result !== id && !r.ingredients.includes(id)));
    };

    const saveRecipe = (recipe: BubbleRecipe) =>
        setRecipes(rs => (rs.some(r => r.id === recipe.id) ? rs.map(r => (r.id === recipe.id ? recipe : r)) : [...rs, recipe]));

    const saveGroup = (group: BubbleGroup) =>
        setGroups(gs => (gs.some(g => g.id === group.id) ? gs.map(g => (g.id === group.id ? group : g)) : [...gs, group]));

    const deleteGroup = (id: string) => {
        setGroups(gs => gs.filter(g => g.id !== id));
        setTiles(ts => ts.map(t => (t.groupId === id ? { ...t, groupId: '' } : t)));
    };

    const deleteRecipe = (id: string) => setRecipes(rs => rs.filter(r => r.id !== id));

    // ─── Play-tab sidebar ─────────────────────────────────────────────────────
    const inspected = inspectId ? tileMap[inspectId] : undefined;
    const madeBy = inspectId ? recipes.filter(r => r.result === inspectId) : [];
    const usedIn = inspectId ? recipes.filter(r => r.a === inspectId || r.ingredients.includes(inspectId)) : [];

    const renderPlay = () => (
        <div className="flex flex-col lg:flex-row gap-3 px-3 w-full max-w-6xl lg:items-start pb-6">
            <div className="flex flex-col items-center flex-shrink-0 w-full lg:w-auto">
                <div className="relative w-full" style={{ maxWidth: CANVAS_W }}>
                    <canvas
                        ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
                        className="rounded-xl border border-gray-800 touch-none w-full"
                        style={{ maxHeight: '60vh', objectFit: 'contain' }}
                        onPointerDown={handleBoardPointerDown}
                    />
                    {flash && (
                        <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
                            <div className="bg-black/75 rounded-2xl px-4 py-1.5 text-sm font-bold text-yellow-200">{flash}</div>
                        </div>
                    )}
                </div>

                <div className="w-full mt-2" style={{ maxWidth: CANVAS_W }}>
                    <div className="text-xs text-gray-600 uppercase tracking-widest mb-1.5 text-center">
                        {spawnable.length === 0
                            ? 'Mark a tile as available in the Tiles tab to add it here'
                            : 'Tap a tile, then tap the board to place it · tap a board tile, then another spot to move it'}
                    </div>
                    <div className="flex flex-col gap-2">
                        {paletteSections.map(sec => (
                            <div key={sec.id || 'none'}>
                                {(groups.length > 0) && (
                                    <div className="text-xs text-gray-500 mb-1 px-1">{sec.name}</div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {sec.tiles.map(t => (
                                        <button key={t.id} onClick={() => selectPalette(t.id)}
                                            className="rounded-2xl p-1 transition-transform"
                                            style={{
                                                transform: paletteId === t.id ? 'scale(1.15)' : undefined,
                                                outline: paletteId === t.id ? '3px solid white' : 'none',
                                            }}>
                                            <TileChip tile={t} size={36} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <button onClick={() => { setEraseMode(m => !m); setPaletteId(null); setMovingCell(null); }}
                            className={`self-start mt-1 text-xs px-3 py-2 rounded-xl border ${eraseMode ? 'bg-red-900/60 border-red-500 text-red-200' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                            {eraseMode ? 'Erasing — tap a tile' : 'Erase'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-w-0 lg:max-w-xs flex flex-col gap-2">
                <div className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-gray-800 bg-gray-900/80 text-center">
                    <span className="text-xs text-gray-500 uppercase tracking-widest">Selected tile</span>
                    {inspected ? (
                        <>
                            <TileSprite pixels={inspected.pixels} size={64} />
                            <span className="text-sm text-gray-200">{inspected.name}</span>
                            {madeBy.length > 0 && <div className="text-xs text-gray-500 uppercase tracking-widest">How to make</div>}
                            {madeBy.map(r => <RecipeView key={r.id} recipe={r} tiles={tileMap} onTileClick={setInspectId} />)}
                            {usedIn.length > 0 && <div className="text-xs text-gray-500 uppercase tracking-widest">Used in</div>}
                            {usedIn.map(r => <RecipeView key={r.id} recipe={r} tiles={tileMap} onTileClick={setInspectId} />)}
                            {madeBy.length === 0 && usedIn.length === 0 && (
                                <span className="text-xs text-gray-600">No recipes use this tile yet.</span>
                            )}
                        </>
                    ) : (
                        <span className="text-xs text-gray-500">Tap a tile to see its name and recipes.</span>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center overflow-y-auto select-none">
            <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-white text-lg z-10">✕</button>

            <div className="flex items-center gap-4 pt-3 pb-2 px-4 w-full max-w-6xl flex-shrink-0">
                <div className="text-lg font-black bg-gradient-to-r from-red-400 via-yellow-300 via-green-400 to-purple-400 bg-clip-text text-transparent">
                    Rainbow Bubble
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Score</div>
                    <div className="text-xl font-black text-yellow-400">{score.toLocaleString()}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Discovered</div>
                    <div className="text-xl font-black text-emerald-400">{discovered.size}/{resultIds.size}</div>
                </div>
                {tab === 'play' && (
                    <button onClick={clearBoard}
                        className="ml-auto mr-8 text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700">
                        Clear
                    </button>
                )}
            </div>

            <div className="flex gap-1 mb-2 flex-shrink-0">
                {(['play', 'tiles', 'recipes'] as Tab[]).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`text-xs px-4 py-1.5 rounded-full border capitalize ${tab === t ? 'bg-purple-700 border-purple-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                        {t}
                    </button>
                ))}
            </div>

            {!loaded ? (
                <div className="text-sm text-gray-500 py-10">Loading…</div>
            ) : tab === 'play' ? (
                renderPlay()
            ) : tab === 'tiles' ? (
                <PixelEditorTilesPanel tiles={tiles} groups={groups} onSave={saveTile} onDelete={deleteTile} onSaveGroup={saveGroup} onDeleteGroup={deleteGroup} />
            ) : (
                <RecipesPanel tiles={tiles} groups={groups} recipes={recipes} onSave={saveRecipe} onDelete={deleteRecipe} />
            )}
        </div>
    );
};

export default RainbowBubble;
