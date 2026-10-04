import React, { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConstBlock { id: string; kind: 'const'; value: number }
interface VarBlock { id: string; kind: 'var'; coeff: number }
interface GroupBlock { id: string; kind: 'group'; multiplier: number; inner: Array<ConstBlock | VarBlock> }
type Block = ConstBlock | VarBlock | GroupBlock;
type Side = 'left' | 'right';

type MenuMode = 'main' | 'combine-pending' | 'remove-pending';
interface BlockMenu { id: string; side: Side; mode: MenuMode }

// ── ID generator ──────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `b${++_uid}`;

// ── Puzzle templates (defs are re-instantiated each game) ─────────────────────

type BlockDef =
    | { kind: 'const'; value: number }
    | { kind: 'var'; coeff: number }
    | { kind: 'group'; multiplier: number; inner: Array<{ kind: 'const'; value: number } | { kind: 'var'; coeff: number }> };

interface PuzzleTemplate {
    level: 1 | 2 | 3;
    leftDefs: BlockDef[];
    rightDefs: BlockDef[];
    solution: number;
    hint: string;
}

function inst(def: BlockDef): Block {
    if (def.kind === 'const') return { id: uid(), kind: 'const', value: def.value };
    if (def.kind === 'var') return { id: uid(), kind: 'var', coeff: def.coeff };
    return {
        id: uid(), kind: 'group', multiplier: def.multiplier,
        inner: def.inner.map(d => d.kind === 'const'
            ? { id: uid(), kind: 'const' as const, value: d.value }
            : { id: uid(), kind: 'var' as const, coeff: d.coeff }),
    };
}

const PUZZLES: PuzzleTemplate[] = [
    // ── Level 1 ──────────────────────────────────────────────────────────────
    {
        level: 1, solution: 4, hint: 'Move the +3 block to the right side',
        leftDefs: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 3 }],
        rightDefs: [{ kind: 'const', value: 7 }]
    },
    {
        level: 1, solution: 7, hint: 'Move the −2 block to the right',
        leftDefs: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: -2 }],
        rightDefs: [{ kind: 'const', value: 5 }]
    },
    {
        level: 1, solution: 5, hint: 'The 4 block is hiding x — move it to the right',
        leftDefs: [{ kind: 'const', value: 4 }, { kind: 'var', coeff: 1 }],
        rightDefs: [{ kind: 'const', value: 9 }]
    },
    {
        level: 1, solution: 7, hint: 'Two number blocks on the right — combine them first',
        leftDefs: [{ kind: 'var', coeff: 1 }],
        rightDefs: [{ kind: 'const', value: 3 }, { kind: 'const', value: 4 }]
    },
    {
        level: 1, solution: 4, hint: 'Move +8 to the right, then combine',
        leftDefs: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 8 }],
        rightDefs: [{ kind: 'const', value: 12 }]
    },
    {
        level: 1, solution: 9, hint: 'Move the 6 to the right side',
        leftDefs: [{ kind: 'const', value: 6 }, { kind: 'var', coeff: 1 }],
        rightDefs: [{ kind: 'const', value: 15 }]
    },

    // ── Level 2 ──────────────────────────────────────────────────────────────
    {
        level: 2, solution: 3, hint: 'Move +3 to the right, combine, then read 2x = ?',
        leftDefs: [{ kind: 'var', coeff: 2 }, { kind: 'const', value: 3 }],
        rightDefs: [{ kind: 'const', value: 9 }]
    },
    {
        level: 2, solution: 3, hint: 'Two x blocks on the left — combine them first',
        leftDefs: [{ kind: 'var', coeff: 1 }, { kind: 'var', coeff: 2 }],
        rightDefs: [{ kind: 'const', value: 9 }]
    },
    {
        level: 2, solution: 5, hint: 'Move −4 to the right (it becomes +4)',
        leftDefs: [{ kind: 'var', coeff: 3 }, { kind: 'const', value: -4 }],
        rightDefs: [{ kind: 'const', value: 11 }]
    },
    {
        level: 2, solution: 4, hint: 'Move the x from the right to the left, then move the numbers',
        leftDefs: [{ kind: 'var', coeff: 2 }, { kind: 'const', value: 3 }],
        rightDefs: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 7 }]
    },
    {
        level: 2, solution: 3, hint: 'Combine the +4x and −1x blocks on the left',
        leftDefs: [{ kind: 'var', coeff: 4 }, { kind: 'var', coeff: -1 }],
        rightDefs: [{ kind: 'const', value: 9 }]
    },
    {
        level: 2, solution: 4, hint: 'Move +5 to the right, then combine',
        leftDefs: [{ kind: 'var', coeff: 2 }, { kind: 'const', value: 5 }],
        rightDefs: [{ kind: 'const', value: 13 }]
    },

    // ── Level 3 ──────────────────────────────────────────────────────────────
    {
        level: 3, solution: 2, hint: 'Tap the group block to expand it, then solve normally',
        leftDefs: [{ kind: 'group', multiplier: 2, inner: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 3 }] }],
        rightDefs: [{ kind: 'const', value: 10 }]
    },
    {
        level: 3, solution: 3, hint: 'Expand the group — notice the −1 becomes −3 after distributing',
        leftDefs: [{ kind: 'group', multiplier: 3, inner: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: -1 }] }],
        rightDefs: [{ kind: 'const', value: 6 }]
    },
    {
        level: 3, solution: 3, hint: 'Expand the group, then move the x from the right to the left',
        leftDefs: [{ kind: 'group', multiplier: 2, inner: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 1 }] }],
        rightDefs: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: 5 }]
    },
    {
        level: 3, solution: 2, hint: 'Two groups — expand both, then simplify each side',
        leftDefs: [{ kind: 'group', multiplier: 3, inner: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: -2 }] }],
        rightDefs: [{ kind: 'group', multiplier: 2, inner: [{ kind: 'var', coeff: 1 }, { kind: 'const', value: -1 }] }, { kind: 'const', value: 2 }]
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function blockLabel(b: Block): string {
    if (b.kind === 'const') return b.value >= 0 ? `+${b.value}` : `${b.value}`;
    if (b.kind === 'var') {
        if (b.coeff === 1) return '+x';
        if (b.coeff === -1) return '−x';
        return b.coeff > 0 ? `+${b.coeff}x` : `${b.coeff}x`;
    }
    const inner = b.inner.map(i => i.kind === 'const' ? `${i.value}` : (i.coeff === 1 ? 'x' : `${i.coeff}x`)).join(', ');
    return `${b.multiplier}×(${inner})`;
}

function equationSide(blocks: Block[]): string {
    if (blocks.length === 0) return '0';
    return blocks.map(b => {
        if (b.kind === 'const') return String(b.value);
        if (b.kind === 'var') return b.coeff === 1 ? 'x' : b.coeff === -1 ? '−x' : `${b.coeff}x`;
        const inner = b.inner.map(i => i.kind === 'const' ? String(i.value) : (i.coeff === 1 ? 'x' : `${i.coeff}x`)).join(' + ');
        return `${b.multiplier}(${inner})`;
    }).reduce((acc, cur) => {
        if (acc === '') return cur;
        return cur.startsWith('-') || cur.startsWith('−') ? `${acc} − ${cur.replace(/^[-−]/, '')}` : `${acc} + ${cur}`;
    }, '');
}

function isSolved(left: Block[], right: Block[]): false | number {
    const hasGroup = [...left, ...right].some(b => b.kind === 'group');
    if (hasGroup) return false;

    const lVars = left.filter(b => b.kind === 'var') as VarBlock[];
    const lConsts = left.filter(b => b.kind === 'const') as ConstBlock[];
    const rVars = right.filter(b => b.kind === 'var') as VarBlock[];
    const rConsts = right.filter(b => b.kind === 'const') as ConstBlock[];

    // All vars on left, all consts on right — or vice versa
    const caseA = lConsts.length === 0 && rVars.length === 0 && lVars.length > 0;
    const caseB = rConsts.length === 0 && lVars.length === 0 && rVars.length > 0;
    if (!caseA && !caseB) return false;

    const varCoeff = caseA
        ? lVars.reduce((s, b) => s + b.coeff, 0)
        : rVars.reduce((s, b) => s + b.coeff, 0);
    const constVal = caseA
        ? rConsts.reduce((s, b) => s + b.value, 0)
        : lConsts.reduce((s, b) => s + b.value, 0);

    if (varCoeff === 0) return false;
    return constVal / varCoeff;
}

// ── Main component ────────────────────────────────────────────────────────────

interface CharInfo {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    xp: number;
    level: number;
}

interface Props {
    onClose: () => void;
    characters?: CharInfo[];
    onComplete?: (completed: number, level: 1 | 2 | 3) => void;
}

const EquationsGame: React.FC<Props> = ({ onClose, characters, onComplete }) => {
    const [level, setLevel] = useState<1 | 2 | 3>(1);
    const [puzzleIdx, setPuzzleIdx] = useState(0);
    const [left, setLeft] = useState<Block[]>([]);
    const [right, setRight] = useState<Block[]>([]);
    const [menu, setMenu] = useState<BlockMenu | null>(null);
    const [shake, setShake] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [solved, setSolved] = useState<number | false>(false);
    const [history, setHistory] = useState<Array<{ left: Block[]; right: Block[] }>>([]);
    const [completed, setCompleted] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [solvedDocked, setSolvedDocked] = useState(false);
    const toastTimer = useRef<number | null>(null);

    const levelPuzzles = PUZZLES.filter(p => p.level === level);
    const template = levelPuzzles[puzzleIdx % levelPuzzles.length];

    const loadPuzzle = useCallback((t: PuzzleTemplate) => {
        setLeft(t.leftDefs.map(inst));
        setRight(t.rightDefs.map(inst));
        setMenu(null);
        setSolved(false);
        setHistory([]);
        setShowHint(false);
        setShake(false);
        setSolvedDocked(false);
    }, []);

    useEffect(() => { loadPuzzle(template); }, [level, puzzleIdx]); // eslint-disable-line

    // ── Toast helper ──────────────────────────────────────────────────────────

    const showToast = (msg: string) => {
        setToast(msg);
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2000);
    };

    // ── Balance checker ───────────────────────────────────────────────────────
    // Returns true if the equation with given sides has the same solution as the template.

    const checkBalance = useCallback((l: Block[], r: Block[]): boolean => {
        const evalSide = (blocks: Block[], xVal: number): number =>
            blocks.reduce((sum, b) => {
                if (b.kind === 'const') return sum + b.value;
                if (b.kind === 'var') return sum + b.coeff * xVal;
                return sum + b.inner.reduce((s, i) =>
                    s + (i.kind === 'const' ? i.value : i.coeff * xVal), 0) * b.multiplier;
            }, 0);
        const lv = evalSide(l, template.solution);
        const rv = evalSide(r, template.solution);
        return Math.abs(lv - rv) < 1e-9;
    }, [template]);

    // ── Persistence ───────────────────────────────────────────────────────────

    const save = (l: Block[], r: Block[]) =>
        setHistory(h => [...h.slice(-12), { left: l, right: r }]);

    const commit = useCallback((newLeft: Block[], newRight: Block[]) => {
        setLeft(newLeft);
        setRight(newRight);
        setMenu(null);
        const result = isSolved(newLeft, newRight);
        if (result !== false) {
            setSolved(result);
            setCompleted(c => c + 1);
        }
    }, []);

    // ── Reset to last saved state with message ────────────────────────────────

    const resetWithMessage = (msg: string) => {
        showToast(msg);
        setShake(true);
        setTimeout(() => setShake(false), 600);
        setMenu(null);
    };

    // ── Operations ────────────────────────────────────────────────────────────

    // Split: peel one unit off a const block (value moves ±1 each click)
    const splitBlock = useCallback((id: string, side: Side) => {
        const blocks = side === 'left' ? left : right;
        const b = blocks.find(b => b.id === id);
        if (!b || b.kind !== 'const') return;
        if (Math.abs(b.value) <= 1) { showToast('Cannot split further'); return; }

        const sign = b.value > 0 ? 1 : -1;
        const newMain: ConstBlock = { id: uid(), kind: 'const', value: b.value - sign };
        const splinter: ConstBlock = { id: uid(), kind: 'const', value: sign };
        const newBlocks = [...blocks.filter(x => x.id !== id), newMain, splinter];
        const newLeft = side === 'left' ? newBlocks : left;
        const newRight = side === 'right' ? newBlocks : right;

        save(left, right);
        commit(newLeft, newRight);
        // Keep menu open on the new block so student can keep splitting
        setMenu({ id: newMain.id, side, mode: 'main' });
    }, [left, right, commit]);

    // Combine two same-side same-kind blocks
    const combineBlocks = useCallback((id1: string, id2: string, side: Side) => {
        const blocks = side === 'left' ? left : right;
        const b1 = blocks.find(b => b.id === id1);
        const b2 = blocks.find(b => b.id === id2);

        if (!b1 || !b2) return;
        if (b1.kind === 'group' || b2.kind === 'group') { resetWithMessage('Cannot combine group blocks'); return; }
        if (b1.kind !== b2.kind) { resetWithMessage('Unlike terms'); return; }

        let merged: Block | null = null;
        if (b1.kind === 'const' && b2.kind === 'const') {
            const sum = b1.value + (b2 as ConstBlock).value;
            merged = sum !== 0 ? { id: uid(), kind: 'const', value: sum } : null;
        } else if (b1.kind === 'var' && b2.kind === 'var') {
            const sum = b1.coeff + (b2 as VarBlock).coeff;
            merged = sum !== 0 ? { id: uid(), kind: 'var', coeff: sum } : null;
        }

        const rest = blocks.filter(b => b.id !== id1 && b.id !== id2);
        const newBlocks = merged ? [...rest, merged] : rest;
        const newLeft = side === 'left' ? newBlocks : left;
        const newRight = side === 'right' ? newBlocks : right;

        if (!checkBalance(newLeft, newRight)) { resetWithMessage('Unbalanced'); return; }

        save(left, right);
        commit(newLeft, newRight);
    }, [left, right, commit, checkBalance]);

    // Remove two blocks (one per side, or both on same side)
    const removeBlocks = useCallback((id1: string, side1: Side, id2: string, side2: Side) => {
        // id1/side1 = anchor (selected first), id2/side2 = target (tapped second)

        if (side1 === side2) {
            // Same-side: both must cancel to zero (A + B = 0). Verify balance.
            const newLeft = left.filter(b => !(b.id === id1 && side1 === 'left') && !(b.id === id2 && side2 === 'left'));
            const newRight = right.filter(b => !(b.id === id1 && side1 === 'right') && !(b.id === id2 && side2 === 'right'));
            if (!checkBalance(newLeft, newRight)) { resetWithMessage('Unbalanced'); return; }
            save(left, right);
            commit(newLeft, newRight);
            return;
        }

        // Cross-side: "subtract anchor from both sides"
        // Anchor side loses the anchor block.
        // Target side: target_new = target - anchor  (if 0, target also disappears).
        const anchorArr = side1 === 'left' ? left : right;
        const targetArr = side2 === 'left' ? left : right;
        const anchor = anchorArr.find(b => b.id === id1);
        const target = targetArr.find(b => b.id === id2);

        if (!anchor || !target || anchor.kind === 'group' || target.kind === 'group') {
            resetWithMessage('Cannot remove group blocks'); return;
        }
        if (anchor.kind !== target.kind) {
            resetWithMessage('Unlike terms'); return;
        }

        let updatedTarget: Block | null = null;
        if (anchor.kind === 'const' && target.kind === 'const') {
            const newVal = target.value - anchor.value;
            updatedTarget = newVal !== 0 ? { ...target, id: uid(), kind: 'const', value: newVal } : null;
        } else if (anchor.kind === 'var' && target.kind === 'var') {
            const newCoeff = target.coeff - anchor.coeff;
            updatedTarget = newCoeff !== 0 ? { ...target, id: uid(), kind: 'var', coeff: newCoeff } : null;
        } else {
            resetWithMessage('Cannot remove these blocks'); return;
        }

        const withoutAnchor = (blocks: Block[]) => blocks.filter(b => b.id !== id1);
        const withUpdatedTarget = (blocks: Block[]) =>
            updatedTarget
                ? blocks.map(b => b.id === id2 ? updatedTarget! : b)
                : blocks.filter(b => b.id !== id2);

        const newLeft = side1 === 'left' ? withoutAnchor(left) : withUpdatedTarget(left);
        const newRight = side1 === 'right' ? withoutAnchor(right) : withUpdatedTarget(right);

        save(left, right);
        commit(newLeft, newRight);
    }, [left, right, commit, checkBalance]);

    // Move a block to the other side — flip its sign (existing mechanic, kept for groups & undo path)
    const moveToOtherSide = useCallback((id: string, fromSide: Side) => {
        const from = fromSide === 'left' ? left : right;
        const to = fromSide === 'left' ? right : left;
        const block = from.find(b => b.id === id);
        if (!block) return;

        let flipped: Block;
        if (block.kind === 'const') {
            flipped = { id: uid(), kind: 'const', value: -block.value };
        } else if (block.kind === 'var') {
            flipped = { id: uid(), kind: 'var', coeff: -block.coeff };
        } else {
            flipped = { id: uid(), kind: 'group', multiplier: -block.multiplier, inner: block.inner };
        }

        const newFrom = from.filter(b => b.id !== id);
        const newTo = [...to, flipped];
        const newLeft = fromSide === 'left' ? newFrom : newTo;
        const newRight = fromSide === 'left' ? newTo : newFrom;
        save(left, right);
        commit(newLeft, newRight);
    }, [left, right, commit]);

    // Expand a group block
    const expandGroup = useCallback((id: string, side: Side) => {
        const blocks = side === 'left' ? left : right;
        const group = blocks.find(b => b.id === id) as GroupBlock | undefined;
        if (!group || group.kind !== 'group') return;

        const expanded: Block[] = group.inner.map(b =>
            b.kind === 'const'
                ? { id: uid(), kind: 'const' as const, value: b.value * group.multiplier }
                : { id: uid(), kind: 'var' as const, coeff: b.coeff * group.multiplier }
        );

        const rest = blocks.filter(b => b.id !== id);
        const newBlocks = [...rest, ...expanded];
        save(left, right);
        const newLeft = side === 'left' ? newBlocks : left;
        const newRight = side === 'right' ? newBlocks : right;
        commit(newLeft, newRight);
    }, [left, right, commit]);

    const handleUndo = () => {
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        setLeft(prev.left);
        setRight(prev.right);
        setHistory(h => h.slice(0, -1));
        setMenu(null);
        setSolved(false);
    };

    // ── Block click ───────────────────────────────────────────────────────────

    const handleBlockClick = (blockId: string, side: Side) => {
        if (solved !== false) return;
        const allBlocks = side === 'left' ? left : right;
        const block = allBlocks.find(b => b.id === blockId);
        if (!block) return;

        // Groups expand immediately
        if (block.kind === 'group') {
            expandGroup(blockId, side);
            return;
        }

        // If a pending-action menu is open
        if (menu) {
            if (menu.mode === 'combine-pending') {
                if (menu.id === blockId && menu.side === side) {
                    // Tapped same block → cancel
                    setMenu(null);
                    return;
                }
                if (menu.side !== side) {
                    resetWithMessage('Blocks must be on the same side to combine');
                    return;
                }
                combineBlocks(menu.id, blockId, side);
                return;
            }
            if (menu.mode === 'remove-pending') {
                if (menu.id === blockId && menu.side === side) {
                    setMenu(null);
                    return;
                }
                removeBlocks(menu.id, menu.side, blockId, side);
                return;
            }
            // Main menu open — tapping a different block switches selection
            if (menu.id === blockId && menu.side === side) {
                setMenu(null);
                return;
            }
        }

        // Open main menu for this block
        setMenu({ id: blockId, side, mode: 'main' });
    };

    const handlePanClick = () => {
        // Tapping the pan always dismisses any open menu; blocks can only be
        // acted on through the Split / Combine / Remove context menu options.
        setMenu(null);
    };

    // ── Render block ───────────────────────────────────────────────────────────

    const renderBlock = (block: Block, side: Side) => {
        if (block.kind === 'group') {
            return (
                <div
                    key={block.id}
                    onClick={e => { e.stopPropagation(); handleBlockClick(block.id, side); }}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-violet-500 bg-violet-950/60 hover:bg-violet-900/70 p-2 transition-all select-none flex flex-col items-center gap-1 min-w-[80px]"
                    title="Tap to expand"
                >
                    <div className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${block.multiplier < 0 ? 'bg-red-800 text-red-200' : 'bg-violet-800 text-violet-200'}`}>
                        {block.multiplier}×
                    </div>
                    <div className="flex items-center gap-1 px-1">
                        <div className="w-1 h-8 bg-amber-600 rounded-sm opacity-50" />
                        <div className="flex gap-1">
                            {block.inner.map(b => (
                                <div key={b.id}
                                    className={`rounded px-1.5 py-1 text-xs font-mono font-bold ${b.kind === 'var' ? 'bg-blue-800 text-blue-200 border border-blue-600' : 'bg-amber-800 text-amber-200 border border-amber-600'}`}>
                                    {b.kind === 'const' ? b.value : (b.coeff === 1 ? 'x' : `${b.coeff}x`)}
                                </div>
                            ))}
                        </div>
                        <div className="w-1 h-8 bg-amber-600 rounded-sm opacity-50" />
                    </div>
                    <div className="text-xs text-violet-400 leading-none">tap to expand</div>
                </div>
            );
        }

        const isConst = block.kind === 'const';
        const isNeg = isConst ? block.value < 0 : block.coeff < 0;
        const label = blockLabel(block);
        const isSelected = menu?.id === block.id && menu?.side === side;
        const isPending = (menu?.mode === 'combine-pending' || menu?.mode === 'remove-pending') && !isSelected;

        const colorBase = isConst
            ? (isNeg ? 'bg-red-900   border-red-600   text-red-100' : 'bg-amber-800  border-amber-500  text-amber-100')
            : (isNeg ? 'bg-indigo-950 border-indigo-600 text-indigo-200' : 'bg-blue-900   border-blue-500   text-blue-100');

        const ringClass = isSelected
            ? 'ring-2 ring-white scale-110 shadow-lg shadow-white/20 z-10'
            : isPending
                ? 'ring-2 ring-yellow-400 animate-pulse cursor-pointer'
                : 'hover:scale-105 hover:brightness-125';

        return (
            <div
                key={block.id}
                onClick={e => { e.stopPropagation(); handleBlockClick(block.id, side); }}
                className={`cursor-pointer rounded-xl border-2 font-mono font-bold text-base text-center
                    transition-all select-none relative flex items-center justify-center
                    w-14 h-14 shrink-0 ${colorBase} ${ringClass}`}
            >
                {label}
                {/* Context menu popover (shown on selected block) */}
                {isSelected && menu?.mode === 'main' && (
                    <div
                        className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden min-w-[100px]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Split — only for const blocks with |value| > 1 */}
                        {block.kind === 'const' && Math.abs(block.value) > 1 && (
                            <button
                                onClick={() => splitBlock(block.id, side)}
                                className="px-4 py-2 text-xs font-semibold text-left text-cyan-300 hover:bg-gray-800 border-b border-gray-800 transition-colors"
                            >
                                ✂ Split
                            </button>
                        )}
                        <button
                            onClick={() => setMenu({ id: block.id, side, mode: 'combine-pending' })}
                            className="px-4 py-2 text-xs font-semibold text-left text-green-300 hover:bg-gray-800 border-b border-gray-800 transition-colors"
                        >
                            + Combine
                        </button>
                        <button
                            onClick={() => setMenu({ id: block.id, side, mode: 'remove-pending' })}
                            className="px-4 py-2 text-xs font-semibold text-left text-red-300 hover:bg-gray-800 transition-colors"
                        >
                            ✕ Remove
                        </button>
                        <button
                            onClick={() => setMenu(null)}
                            className="px-4 py-2 text-xs text-gray-600 hover:text-gray-400 hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
                {/* Pending-action badge */}
                {isSelected && menu?.mode === 'combine-pending' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-green-600 rounded-full w-5 h-5 flex items-center justify-center text-white font-bold leading-none">+</span>
                )}
                {isSelected && menu?.mode === 'remove-pending' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-red-600 rounded-full w-5 h-5 flex items-center justify-center text-white font-bold leading-none">✕</span>
                )}
                {isPending && menu?.mode === 'combine-pending' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-yellow-500 rounded-full w-5 h-5 flex items-center justify-center text-gray-900 font-bold leading-none">+</span>
                )}
                {isPending && menu?.mode === 'remove-pending' && (
                    <span className="absolute -top-1.5 -right-1.5 text-xs bg-yellow-500 rounded-full w-5 h-5 flex items-center justify-center text-gray-900 font-bold leading-none">✕</span>
                )}
            </div>
        );
    };

    // ── Render pan ─────────────────────────────────────────────────────────────

    const renderPan = (panSide: Side, blocks: Block[]) => {
        return (
            <div
                onClick={() => handlePanClick()}
                className={`flex flex-col items-center gap-2 min-w-0 flex-1 transition-all ${shake ? 'animate-bounce' : ''}`}
            >
                {/* Block area */}
                <div className={`flex flex-wrap gap-2 justify-center content-end min-h-[120px] w-full max-w-xs p-3 rounded-2xl border-2 transition-all
                    border-transparent bg-gray-800/30`}
                >
                    {blocks.length === 0
                        ? <div className="text-gray-700 text-xs italic self-center">empty</div>
                        : blocks.map(b => renderBlock(b, panSide))
                    }
                </div>
                {/* Pan plate */}
                <div className="h-2 w-40 bg-gradient-to-r from-amber-800 via-amber-600 to-amber-800 rounded-full shadow-md" />
            </div>
        );
    };

    // ── Solution string ────────────────────────────────────────────────────────

    const solvedStr = solved !== false ? `x = ${Number.isInteger(solved) ? solved : solved.toFixed(2)}` : '';

    // ── Beam tilt (purely cosmetic based on block count imbalance) ─────────────
    const tiltDeg = solved !== false ? 0
        : shake ? (Math.random() > 0.5 ? 12 : -12)
            : Math.max(-8, Math.min(8, (right.length - left.length) * 2));

    // ── Instruction line ──────────────────────────────────────────────────────

    const instrLine = (() => {
        if (menu?.mode === 'combine-pending') return '+ Combine — tap another block on the same side to combine with';
        if (menu?.mode === 'remove-pending') return '✕ Remove — tap another block to remove both';
        if (menu?.mode === 'main') return 'Choose an action: Split · Combine · Remove — or tap another block';
        if (showHint) return `💡 ${template.hint}`;
        return 'Tap a block to open its actions. Get x alone on one side.';
    })();

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col overflow-hidden">

            {/* ── Toast notification ──────────────────────────────── */}
            {toast && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-500 text-red-200 text-sm font-semibold px-5 py-2 rounded-xl shadow-xl pointer-events-none animate-bounce">
                    {toast}
                </div>
            )}

            {/* ── Header ────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xl">⚖️</span>
                    <span className="font-bold text-white text-sm hidden sm:inline">Equations</span>
                </div>

                {/* Level tabs */}
                <div className="flex gap-1">
                    {([1, 2, 3] as const).map(l => (
                        <button key={l}
                            onClick={() => { setLevel(l); setPuzzleIdx(0); }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${level === l
                                ? 'bg-violet-700 border-violet-500 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-violet-600'}`}>
                            L{l}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-gray-500 hidden sm:inline">✓ {completed}</span>
                    <button onClick={() => setShowHint(h => !h)}
                        className={`px-2 py-1 rounded text-xs border transition-colors ${showHint ? 'bg-violet-900 border-violet-600 text-violet-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                        💡
                    </button>
                    <button onClick={handleUndo} disabled={history.length === 0}
                        className="px-2 py-1 rounded text-xs text-gray-400 bg-gray-800 border border-gray-700 hover:border-gray-600 disabled:opacity-30 transition-colors">
                        ↩
                    </button>
                    <button onClick={() => loadPuzzle(template)}
                        className="px-2 py-1 rounded text-xs text-gray-400 bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors">
                        ↺
                    </button>
                    <button onClick={() => { onComplete?.(completed, level); onClose(); }} className="text-gray-500 hover:text-white ml-1 text-lg leading-none">✕</button>
                </div>
            </div>

            {/* ── Main ──────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4 overflow-hidden min-h-0">

                {/* Character strip */}
                {characters && characters.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                        {characters.map(c => (
                            <div key={c.id} className="flex items-center gap-2 bg-gray-800/80 rounded-lg px-3 py-1.5 text-xs border border-gray-700">
                                <span className="font-semibold text-white">{c.name}</span>
                                <span className="text-red-400">❤️ {c.hp}/{c.maxHp}</span>
                                <span className="text-sky-300">Lv.{c.level}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Equation text display */}
                <div className="font-mono text-sm text-gray-400 text-center select-none">
                    {equationSide(left)} <span className="text-gray-600 mx-1">=</span> {equationSide(right)}
                </div>

                {/* Instruction / hint line */}
                <div className="text-xs text-gray-500 text-center max-w-sm leading-relaxed min-h-[2rem] flex items-center justify-center">
                    {instrLine}
                </div>

                {/* ── Balance beam assembly ─────────────────────────── */}
                <div className="flex flex-col items-center w-full max-w-2xl">

                    {/* Fulcrum top cap + chain anchors */}
                    <div className="relative w-full flex items-end justify-center" style={{ height: 60 }}>
                        {/* Beam (rotates around center) */}
                        <div
                            className="absolute bottom-0 left-4 right-4 transition-transform duration-500 ease-out"
                            style={{ transform: `rotate(${tiltDeg}deg)`, transformOrigin: '50% 100%' }}
                        >
                            {/* Beam bar */}
                            <div className="relative h-3 mx-8 bg-gradient-to-r from-amber-800 via-amber-500 to-amber-800 rounded-full shadow-lg">
                                {/* Center pivot dot */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-gray-300 rounded-full border-2 border-gray-400 shadow z-10" />
                                {/* Chain lines */}
                                <div className="absolute left-6  top-full w-px bg-gray-600" style={{ height: 24 }} />
                                <div className="absolute right-6 top-full w-px bg-gray-600" style={{ height: 24 }} />
                            </div>
                        </div>

                        {/* Fulcrum pole */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                            <div className="w-2 bg-gray-600 rounded-t" style={{ height: 44 }} />
                            <div className="w-10 h-3 bg-gray-700 rounded-full" />
                        </div>
                    </div>

                    {/* Pans row */}
                    <div className="flex items-start justify-between w-full gap-4 mt-1">
                        {renderPan('left', left)}

                        {/* Center equals */}
                        <div className="text-gray-600 font-bold text-xl pt-12 select-none shrink-0">=</div>

                        {renderPan('right', right)}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-gray-600 select-none">
                    <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded bg-blue-900 border border-blue-500 text-blue-200 flex items-center justify-center font-mono text-xs">x</div>
                        <span>unknown</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded bg-amber-800 border border-amber-500 text-amber-200 flex items-center justify-center font-mono text-xs">5</div>
                        <span>known</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded bg-red-900 border border-red-600 text-red-200 flex items-center justify-center font-mono text-xs">−</div>
                        <span>negative</span>
                    </div>
                    {level === 3 && (
                        <div className="flex items-center gap-1">
                            <div className="rounded border-2 border-dashed border-violet-500 px-1 text-violet-300 font-mono text-xs">2×</div>
                            <span>group (tap)</span>
                        </div>
                    )}
                </div>

                {/* Puzzle dots */}
                <div className="flex gap-1.5">
                    {levelPuzzles.map((_, i) => (
                        <button key={i}
                            onClick={() => setPuzzleIdx(i)}
                            className={`w-5 h-5 rounded-full text-xs font-bold transition-all ${i === puzzleIdx % levelPuzzles.length
                                ? 'bg-violet-600 text-white scale-110'
                                : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}>
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Solved overlay ─────────────────────────────────────── */}
            {solved !== false && !solvedDocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                    <div className="bg-gray-900 border-2 border-emerald-500 rounded-2xl p-8 text-center max-w-xs w-full mx-4 shadow-2xl">
                        <div className="text-5xl mb-3">⚖️</div>
                        <h2 className="text-2xl font-bold text-emerald-400 mb-1">Balanced!</h2>
                        <div className="text-4xl font-mono font-bold text-white mb-5">{solvedStr}</div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setPuzzleIdx(i => i + 1); setSolved(false); setSolvedDocked(false); }}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-colors">
                                Next →
                            </button>
                            <button
                                onClick={() => { loadPuzzle(template); }}
                                className="py-2.5 px-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors">
                                ↺
                            </button>
                            <button
                                onClick={() => setSolvedDocked(true)}
                                title="Move to corner"
                                className="py-2.5 px-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors">
                                ↗
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Solved badge (docked top-right) ─────────────────────── */}
            {solved !== false && solvedDocked && (
                <div className="absolute top-14 right-3 z-20 flex items-center gap-2 bg-gray-900 border border-emerald-600 rounded-xl px-3 py-2 shadow-xl">
                    <span className="text-emerald-400 font-bold text-sm">✓ {solvedStr}</span>
                    <button
                        onClick={() => { setPuzzleIdx(i => i + 1); setSolved(false); setSolvedDocked(false); }}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg transition-colors">
                        Next →
                    </button>
                    <button
                        onClick={() => setSolvedDocked(false)}
                        title="Expand"
                        className="text-gray-500 hover:text-white text-xs transition-colors">
                        ↙
                    </button>
                </div>
            )}
        </div>
    );
};

export default EquationsGame;
