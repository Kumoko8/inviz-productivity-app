import React, { useState } from 'react';
import { MERGES } from '../KanjiDropData';
import type { CustomKanjiEntry } from '../../../services/kanjiDropService';
import { GoalGroup, lookupTile } from './kanjiDropTypes';
import TilePickerInput from './TilePickerInput';

type Recipe = { a: string; b: string; c: string; d: string; xp: number };

type Props = {
    allTargetPool: string[];
    targetId: string;
    groups: GoalGroup[];
    customKanjis: CustomKanjiEntry[];
    onSaveGroups: (updated: GoalGroup[]) => void;
    onAddCustomKanji: (char: string, meaning: string, tier: number, recipe?: Recipe) => string;
    onDeleteCustomKanji: (id: string) => void;
    onUpdateCustomKanji: (id: string, char: string, meaning: string, tier: number, recipe?: Recipe) => void;
};

const GoalsPanel: React.FC<Props> = ({
    allTargetPool, targetId, groups, customKanjis,
    onSaveGroups, onAddCustomKanji, onDeleteCustomKanji, onUpdateCustomKanji,
}) => {
    // ── Panel-local UI state ──────────────────────────────────────────────────
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [isAddingKanji, setIsAddingKanji] = useState(false);
    const [newKanjiChar, setNewKanjiChar] = useState('');
    const [newKanjiMeaning, setNewKanjiMeaning] = useState('');
    const [newKanjiTier, setNewKanjiTier] = useState(3);
    const [newRecipeA, setNewRecipeA] = useState('');
    const [newRecipeB, setNewRecipeB] = useState('');
    const [newRecipeC, setNewRecipeC] = useState('');
    const [newRecipeD, setNewRecipeD] = useState('');
    const [newRecipeXP, setNewRecipeXP] = useState(300);
    const [newKanjiGroup, setNewKanjiGroup] = useState<string | null>(null);
    const [expandedKanjiId, setExpandedKanjiId] = useState<string | null>(null);
    const [duplicateRecipeError, setDuplicateRecipeError] = useState<string | null>(null);
    const [editingKanjiId, setEditingKanjiId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<{ char: string; meaning: string; tier: number; a: string; b: string; c: string; d: string; xp: number } | null>(null);
    const [editDupeError, setEditDupeError] = useState<string | null>(null);
    const [assigningKanjiId, setAssigningKanjiId] = useState<string | null>(null);
    const [confirmDeleteKanji, setConfirmDeleteKanji] = useState<string | null>(null);
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
    const [goalSearch, setGoalSearch] = useState('');
    const [searchMode, setSearchMode] = useState<'kanji' | 'ingredient'>('kanji');

    const tileMatches = (tileId: string, q: string) => {
        const def = lookupTile(tileId);
        return !!def && (def.char.includes(q) || def.meaning.toLowerCase().includes(q));
    };

    const matchesSearch = (id: string) => {
        const q = goalSearch.trim().toLowerCase();
        if (!q) return true;
        if (searchMode === 'kanji') return tileMatches(id, q);
        const recipe = getRecipe(id);
        if (!recipe) return false;
        return [recipe.a, recipe.b, recipe.c, recipe.d].some(t => t !== '' && tileMatches(t, q));
    };

    // ── Group helpers ─────────────────────────────────────────────────────────
    const toggleGroupOpen = (groupId: string) =>
        onSaveGroups(groups.map(g => g.id === groupId ? { ...g, open: !g.open } : g));

    const deleteGroup = (groupId: string) =>
        onSaveGroups(groups.filter(g => g.id !== groupId));

    const addGroup = () => {
        if (!newGroupName.trim()) return;
        onSaveGroups([...groups, { id: Date.now().toString(), name: newGroupName.trim(), memberIds: [], open: true }]);
        setNewGroupName('');
        setIsAddingGroup(false);
    };

    const reorderInGroup = (groupId: string, kanjiId: string, direction: 'up' | 'down') => {
        onSaveGroups(groups.map(g => {
            if (g.id !== groupId) return g;
            const ids = [...g.memberIds];
            const idx = ids.indexOf(kanjiId);
            if (idx < 0) return g;
            const swapWith = direction === 'up' ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= ids.length) return g;
            [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
            return { ...g, memberIds: ids };
        }));
    };

    const toggleGroupMembership = (kanjiId: string, groupId: string) => {
        onSaveGroups(groups.map(g => g.id !== groupId ? g : {
            ...g,
            memberIds: g.memberIds.includes(kanjiId)
                ? g.memberIds.filter(m => m !== kanjiId)
                : [...g.memberIds, kanjiId],
        }));
        setAssigningKanjiId(null);
    };

    const renderAssignPopover = (id: string) => (
        <div className="ml-1 mt-0.5 mb-1 p-1.5 bg-gray-800/90 rounded-lg border border-gray-700">
            <div className="flex flex-col gap-1">
                {groups.map(g => {
                    const isMember = g.memberIds.includes(id);
                    return (
                        <button key={g.id}
                            onClick={e => { e.stopPropagation(); toggleGroupMembership(id, g.id); }}
                            className={`text-xs text-left px-2 py-0.5 rounded truncate ${isMember ? 'bg-purple-700 hover:bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                        >{isMember ? '✓ ' : ''}{g.name}</button>
                    );
                })}
                <button onClick={e => { e.stopPropagation(); setAssigningKanjiId(null); }}
                    className="text-xs text-gray-600 hover:text-gray-400 text-left mt-0.5"
                >✕ close</button>
            </div>
        </div>
    );

    // ── Kanji helpers ─────────────────────────────────────────────────────────
    const getRecipe = (resultId: string): Recipe | null => {
        if (resultId.startsWith('custom_')) {
            const entry = customKanjis.find(e => e.id === resultId);
            return entry?.recipe ?? null;
        }
        const row = MERGES.find(([, , , , result]) => result === resultId);
        if (!row) return null;
        return { a: row[0], b: row[1], c: row[2], d: row[3], xp: row[5] };
    };

    const addKanji = () => {
        const char = newKanjiChar.trim();
        const meaning = newKanjiMeaning.trim();
        if (!char || !meaning) return;
        const a = newRecipeA.trim();
        const recipe: Recipe | undefined = a
            ? { a, b: newRecipeB.trim(), c: newRecipeC.trim(), d: newRecipeD.trim(), xp: newRecipeXP }
            : undefined;
        if (recipe) {
            const required = [recipe.b, recipe.c, recipe.d].filter(x => x !== '').sort();
            const key = required.join(',');
            const dupeInMerges = MERGES.some(([ma, mb, mc, md]) =>
                ma === recipe.a && [mb, mc, md].filter(x => x !== '').sort().join(',') === key
            );
            const dupeInCustom = customKanjis.some(e => {
                if (!e.recipe) return false;
                const ck = [e.recipe.b, e.recipe.c, e.recipe.d].filter(x => x !== '').sort().join(',');
                return e.recipe.a === recipe.a && ck === key;
            });
            if (dupeInMerges || dupeInCustom) {
                setDuplicateRecipeError('Duplicate recipe! Please try a new combination.');
                return;
            }
        }
        setDuplicateRecipeError(null);
        const newId = onAddCustomKanji(char, meaning, newKanjiTier, recipe);
        if (newKanjiGroup) toggleGroupMembership(newId, newKanjiGroup);
        setNewKanjiChar(''); setNewKanjiMeaning(''); setNewKanjiTier(3);
        setNewRecipeA(''); setNewRecipeB(''); setNewRecipeC(''); setNewRecipeD(''); setNewRecipeXP(300);
        setNewKanjiGroup(null);
        setIsAddingKanji(false);
    };

    // ── Edit custom kanji ─────────────────────────────────────────────────────
    const startEdit = (id: string) => {
        const entry = customKanjis.find(e => e.id === id);
        if (!entry) return;
        setEditingKanjiId(id);
        setEditFields({
            char: entry.char, meaning: entry.meaning, tier: entry.tier,
            a: entry.recipe?.a ?? '', b: entry.recipe?.b ?? '',
            c: entry.recipe?.c ?? '', d: entry.recipe?.d ?? '',
            xp: entry.recipe?.xp ?? 300,
        });
        setEditDupeError(null);
    };

    const saveEdit = () => {
        if (!editingKanjiId || !editFields) return;
        const { char, meaning, tier, a, b, c, d, xp } = editFields;
        if (!char.trim() || !meaning.trim()) return;
        const recipe: Recipe | undefined = a.trim()
            ? { a: a.trim(), b: b.trim(), c: c.trim(), d: d.trim(), xp }
            : undefined;
        if (recipe) {
            const required = [recipe.b, recipe.c, recipe.d].filter(x => x !== '').sort();
            const key = required.join(',');
            const dupeInMerges = MERGES.some(([ma, mb, mc, md]) =>
                ma === recipe.a && [mb, mc, md].filter(x => x !== '').sort().join(',') === key
            );
            const dupeInCustom = customKanjis.some(e => {
                if (e.id === editingKanjiId) return false;
                if (!e.recipe) return false;
                const ck = [e.recipe.b, e.recipe.c, e.recipe.d].filter(x => x !== '').sort().join(',');
                return e.recipe.a === recipe.a && ck === key;
            });
            if (dupeInMerges || dupeInCustom) {
                setEditDupeError('Duplicate recipe! Please try a new combination.');
                return;
            }
        }
        setEditDupeError(null);
        onUpdateCustomKanji(editingKanjiId, char.trim(), meaning.trim(), tier, recipe);
        setEditingKanjiId(null);
        setEditFields(null);
    };

    const cancelEdit = () => {
        setEditingKanjiId(null);
        setEditFields(null);
        setEditDupeError(null);
    };

    // ── Inline chip for recipe display ────────────────────────────────────────
    const tileChip = (id: string, onClick?: () => void) => {
        const d = lookupTile(id);
        if (!d) return <span key={id} className="text-gray-600 italic">{id}</span>;
        return (
            <span key={id} title={`${d.char} — ${d.meaning}`}
                onClick={onClick}
                className={`inline-flex items-center gap-0.5 px-1 rounded font-bold leading-none${onClick ? ' cursor-pointer hover:opacity-75' : ''}`}
                style={{ background: d.color, color: d.textColor, fontFamily: 'serif', fontSize: 11, paddingTop: 2, paddingBottom: 2 }}>
                {d.char}
                <span style={{ fontFamily: 'sans-serif', fontWeight: 'normal', fontSize: 9, opacity: 0.85 }}>{d.meaning}</span>
            </span>
        );
    };

    const renderExpandedContent = (id: string, isCustom: boolean) => {
        if (editingKanjiId === id && editFields) {
            return (
                <div className="pb-1.5 mt-0.5">
                    <div className="p-1.5 bg-gray-800/90 rounded-lg border border-gray-700">
                        <div className="text-xs text-gray-500 mb-1">Edit</div>
                        <input
                            value={editFields.char}
                            onChange={e => setEditFields(f => f && ({ ...f, char: e.target.value }))}
                            placeholder="Kanji" maxLength={4}
                            className="w-full text-sm bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 outline-none focus:border-gray-400 mb-1 text-center font-bold"
                            style={{ fontFamily: 'serif' }}
                        />
                        <input
                            value={editFields.meaning}
                            onChange={e => setEditFields(f => f && ({ ...f, meaning: e.target.value }))}
                            placeholder="Meaning"
                            className="w-full text-xs bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 outline-none focus:border-gray-400 mb-1"
                        />
                        <div className="flex items-center gap-1 mb-1.5">
                            <span className="text-xs text-gray-500 flex-shrink-0">Tier:</span>
                            <select value={editFields.tier} onChange={e => setEditFields(f => f && ({ ...f, tier: Number(e.target.value) }))}
                                className="text-xs bg-gray-900 text-white px-1 py-0.5 rounded border border-gray-600 flex-1 min-w-0">
                                {Array.from({ length: 20 }, (_, i) => i + 1).map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="border-t border-gray-700 pt-1 mb-1">
                            <div className="text-xs text-gray-500 mb-1">Recipe</div>
                            <div className="grid grid-cols-2 gap-1 mb-1">
                                <TilePickerInput value={editFields.a} onChange={v => setEditFields(f => f && ({ ...f, a: v }))} placeholder="Anchor (A)" />
                                <TilePickerInput value={editFields.b} onChange={v => setEditFields(f => f && ({ ...f, b: v }))} placeholder="Neighbour B" />
                                <TilePickerInput value={editFields.c} onChange={v => setEditFields(f => f && ({ ...f, c: v }))} placeholder="Neighbour C" />
                                <TilePickerInput value={editFields.d} onChange={v => setEditFields(f => f && ({ ...f, d: v }))} placeholder="Neighbour D" />
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 flex-shrink-0">XP:</span>
                                <input type="number" value={editFields.xp} onChange={e => setEditFields(f => f && ({ ...f, xp: Number(e.target.value) }))}
                                    min={1} step={50}
                                    className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded border border-gray-600 outline-none focus:border-purple-500 w-16" />
                            </div>
                        </div>
                        {editDupeError && <div className="text-xs text-red-400 mb-1">{editDupeError}</div>}
                        <div className="flex justify-end gap-1">
                            <button onClick={saveEdit} className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600">✓ Save</button>
                            <button onClick={cancelEdit} className="text-xs text-gray-600 hover:text-gray-400 px-1">✕</button>
                        </div>
                    </div>
                </div>
            );
        }
        const def = lookupTile(id);
        if (!def) return null;
        const recipe = getRecipe(id);
        const ingredients = recipe ? [recipe.b, recipe.c, recipe.d].filter(x => x !== '') : [];
        return (
            <div className="pl-7 pb-1.5 space-y-0.5">
                <div className="text-xs text-gray-600">Tier {def.tier}</div>
                {recipe ? (
                    <div className="flex flex-wrap items-center gap-1">
                        {tileChip(recipe.a, isCustom ? () => startEdit(id) : undefined)}
                        {ingredients.map((ing, i) => (
                            <React.Fragment key={i}><span className="text-gray-600 text-xs">+</span>{tileChip(ing, isCustom ? () => startEdit(id) : undefined)}</React.Fragment>
                        ))}
                        <span className="text-gray-600 text-xs">→</span>
                        {tileChip(id)}
                        <span className="text-yellow-500 text-xs">+{recipe.xp}xp</span>
                    </div>
                ) : (
                    isCustom
                        ? <button onClick={() => startEdit(id)} className="text-xs text-blue-500 hover:text-blue-400 underline">✎ add recipe</button>
                        : <div className="text-xs text-gray-700 italic">no recipe</div>
                )}
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-shrink-0">
            {/* New group input */}
            {isAddingGroup && (
                <div className="mb-2 flex gap-1">
                    <input
                        autoFocus
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setIsAddingGroup(false); }}
                        placeholder="Group name…"
                        className="flex-1 min-w-0 text-xs bg-gray-800 text-white px-1.5 py-0.5 rounded border border-gray-600 outline-none focus:border-gray-400"
                    />
                    <button onClick={addGroup} className="text-xs text-gray-400 hover:text-white flex-shrink-0">✓</button>
                    <button onClick={() => setIsAddingGroup(false)} className="text-xs text-gray-600 hover:text-gray-400 flex-shrink-0">✕</button>
                </div>
            )}

            {/* New kanji form */}
            {isAddingKanji && (
                <div className="mb-2 p-1.5 bg-gray-800/90 rounded-lg border border-gray-700">
                    <div className="text-xs text-gray-500 mb-1.5">Add kanji to goal list</div>
                    <input
                        autoFocus
                        value={newKanjiChar}
                        onChange={e => setNewKanjiChar(e.target.value)}
                        placeholder="Kanji (e.g. 走)"
                        maxLength={4}
                        className="w-full text-sm bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 outline-none focus:border-gray-400 mb-1 text-center font-bold"
                        style={{ fontFamily: 'serif' }}
                    />
                    <input
                        value={newKanjiMeaning}
                        onChange={e => setNewKanjiMeaning(e.target.value)}
                        placeholder="Meaning (e.g. run)"
                        className="w-full text-xs bg-gray-900 text-white px-2 py-1 rounded border border-gray-600 outline-none focus:border-gray-400 mb-1"
                    />
                    <div className="flex items-center gap-1 mb-1.5">
                        <span className="text-xs text-gray-500 flex-shrink-0">Tier:</span>
                        <select
                            value={newKanjiTier}
                            onChange={e => setNewKanjiTier(Number(e.target.value))}
                            className="text-xs bg-gray-900 text-white px-1 py-0.5 rounded border border-gray-600 flex-1 min-w-0"
                        >
                            {Array.from({ length: 20 }, (_, i) => i + 1).map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    {groups.length > 0 && (
                        <div className="flex items-center gap-1 mb-2">
                            <span className="text-xs text-gray-500 flex-shrink-0">Group:</span>
                            <select value={newKanjiGroup ?? ''} onChange={e => setNewKanjiGroup(e.target.value || null)}
                                className="text-xs bg-gray-900 text-white px-1 py-0.5 rounded border border-gray-600 flex-1 min-w-0">
                                <option value="">— none —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="border-t border-gray-700 pt-1.5 mb-1.5">
                        <div className="text-xs text-gray-500 mb-1">Recipe <span className="text-gray-700">(optional — makes it buildable)</span></div>
                        <div className="text-xs text-gray-600 mb-1">Tile IDs: type the id shown in game (e.g. hline, fire…)</div>
                        <div className="grid grid-cols-2 gap-1 mb-1">
                            <TilePickerInput value={newRecipeA} onChange={v => { setNewRecipeA(v); setDuplicateRecipeError(null); }} placeholder="Anchor (A)" />
                            <TilePickerInput value={newRecipeB} onChange={v => { setNewRecipeB(v); setDuplicateRecipeError(null); }} placeholder="Neighbour B" />
                            <TilePickerInput value={newRecipeC} onChange={v => { setNewRecipeC(v); setDuplicateRecipeError(null); }} placeholder="Neighbour C" />
                            <TilePickerInput value={newRecipeD} onChange={v => { setNewRecipeD(v); setDuplicateRecipeError(null); }} placeholder="Neighbour D" />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500 flex-shrink-0">XP:</span>
                            <input type="number" value={newRecipeXP} onChange={e => setNewRecipeXP(Number(e.target.value))}
                                min={1} step={50}
                                className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded border border-gray-600 outline-none focus:border-purple-500 w-16" />
                        </div>
                    </div>
                    {duplicateRecipeError && (
                        <div className="text-xs text-red-400 mb-1">{duplicateRecipeError}</div>
                    )}
                    <div className="flex justify-end gap-1">
                        <button onClick={addKanji} className="text-xs text-gray-400 hover:text-white px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600">✓ Add</button>
                        <button onClick={() => { setIsAddingKanji(false); setDuplicateRecipeError(null); setNewKanjiGroup(null); }} className="text-xs text-gray-600 hover:text-gray-400 px-1">✕</button>
                    </div>
                </div>
            )}

            {/* Add group / add kanji buttons (shown when neither form is open) */}
            {!isAddingGroup && !isAddingKanji && (
                <div className="flex gap-1 mb-2">
                    <button
                        onClick={() => { setIsAddingGroup(true); setAssigningKanjiId(null); }}
                        className="text-gray-600 hover:text-gray-300 text-xs px-1"
                        title="New group"
                    >＋ group</button>
                    <button
                        onClick={() => { setIsAddingKanji(true); setAssigningKanjiId(null); }}
                        className="text-gray-600 hover:text-gray-300 text-xs px-1"
                        title="Add kanji"
                    >＋字 kanji</button>
                </div>
            )}

            {/* Search bar — hidden while add forms are open */}
            {!isAddingGroup && !isAddingKanji && (
                <div className="sticky top-0 z-10 bg-gray-950 pb-1 flex gap-1">
                    <input
                        value={goalSearch}
                        onChange={e => setGoalSearch(e.target.value)}
                        placeholder={searchMode === 'kanji' ? 'Search kanji…' : 'Search by ingredient…'}
                        className="flex-1 min-w-0 text-xs bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 outline-none focus:border-gray-500 placeholder-gray-600"
                    />
                    <select
                        value={searchMode}
                        onChange={e => setSearchMode(e.target.value as 'kanji' | 'ingredient')}
                        className="text-xs bg-gray-800 text-gray-300 px-1 py-1 rounded border border-gray-700 outline-none focus:border-gray-500"
                    >
                        <option value="kanji">Kanji</option>
                        <option value="ingredient">Ingredient</option>
                    </select>
                </div>
            )}

            {/* Named groups */}
            </div>
            <div className="overflow-y-auto flex-1 min-h-0">
            {/* Named groups */}
            {groups.map(group => {
                const members = group.memberIds.filter(id => {
                    if (!lookupTile(id)) return false;
                    if (!goalSearch.trim()) return true;
                    return matchesSearch(id);
                });
                const isOpen = group.open || (!!goalSearch.trim() && members.length > 0);
                return (
                    <div key={group.id} className="mb-2">
                        <div className="flex items-center gap-1 mb-0.5">
                            <button onClick={() => toggleGroupOpen(group.id)}
                                className="text-gray-600 hover:text-gray-300 flex-shrink-0"
                                style={{ fontSize: 8 }}
                            >{isOpen ? '▼' : '▶'}</button>
                            <span className="text-xs text-gray-500 flex-1 truncate">{group.name}</span>
                            {confirmDeleteGroup === group.id ? (
                                <span className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-gray-500 text-xs">Sure?</span>
                                    <button onClick={() => { deleteGroup(group.id); setConfirmDeleteGroup(null); }}
                                        className="text-red-400 hover:text-red-300 text-xs font-bold"
                                    >✓</button>
                                    <button onClick={() => setConfirmDeleteGroup(null)}
                                        className="text-gray-500 hover:text-gray-300 text-xs font-bold"
                                    >✗</button>
                                </span>
                            ) : (
                                <button onClick={() => setConfirmDeleteGroup(group.id)}
                                    className="text-gray-700 hover:text-red-400 text-xs flex-shrink-0"
                                    title="Delete group"
                                >✕</button>
                            )}
                        </div>
                        {isOpen && (
                            <>
                                {members.length === 0 && (
                                    <div className="text-xs text-gray-700 pl-3 italic">empty</div>
                                )}
                                {members.map((id, memberIdx) => {
                                    const def = lookupTile(id);
                                    if (!def) return null;
                                    const isCurrent = id === targetId;
                                    const isCustom = id.startsWith('custom_');
                                    const isExpanded = expandedKanjiId === id;
                                    const rawIdx = group.memberIds.indexOf(id);
                                    const canReorder = !goalSearch.trim();
                                    return (
                                        <div key={id} className={`rounded transition-colors ${isCurrent ? 'opacity-100' : 'opacity-50'} ${isExpanded || editingKanjiId === id ? 'bg-gray-800/60' : ''}`}>
                                            <div className="flex items-center gap-1 py-0.5 pl-2 cursor-pointer"
                                                onClick={() => setExpandedKanjiId(isExpanded ? null : id)}>
                                                <span className="flex-shrink-0 flex items-center justify-center font-bold"
                                                    style={{ width: 24, height: 24, fontSize: 14, fontFamily: 'serif', background: def.color, color: def.textColor, borderRadius: 6, boxShadow: isCurrent ? `0 0 10px ${def.glow}` : 'none', outline: isCurrent ? `2px solid ${def.glow}` : 'none' }}
                                                >{def.char}</span>
                                                <span className="text-xs text-gray-400 leading-tight truncate flex-1">{def.meaning}</span>
                                                {isCustom && (
                                                    <button onClick={e => { e.stopPropagation(); startEdit(id); }}
                                                        className="flex-shrink-0 text-yellow-500 hover:text-yellow-300 text-xs"
                                                        title="Edit kanji"
                                                    >✎</button>
                                                )}
                                                <span className="text-gray-700 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                                                {canReorder && (
                                                    <>
                                                        <button onClick={e => { e.stopPropagation(); reorderInGroup(group.id, id, 'up'); }}
                                                            disabled={rawIdx === 0}
                                                            className="flex-shrink-0 text-gray-700 hover:text-gray-400 text-xs disabled:opacity-20 disabled:cursor-default"
                                                            title="Move up"
                                                        >↑</button>
                                                        <button onClick={e => { e.stopPropagation(); reorderInGroup(group.id, id, 'down'); }}
                                                            disabled={rawIdx === group.memberIds.length - 1}
                                                            className="flex-shrink-0 text-gray-700 hover:text-gray-400 text-xs disabled:opacity-20 disabled:cursor-default"
                                                            title="Move down"
                                                        >↓</button>
                                                    </>
                                                )}
                                                <button onClick={e => { e.stopPropagation(); setAssigningKanjiId(id === assigningKanjiId ? null : id); }}
                                                    className="flex-shrink-0 text-gray-700 hover:text-gray-400 text-xs"
                                                    title="Manage groups"
                                                >⊞</button>
                                                <button onClick={e => { e.stopPropagation(); toggleGroupMembership(id, group.id); }}
                                                    className="flex-shrink-0 text-gray-700 hover:text-red-400 text-xs"
                                                    title="Remove from this group"
                                                >×</button>
                                            </div>
                                            {assigningKanjiId === id && renderAssignPopover(id)}
                            {(isExpanded || editingKanjiId === id) && renderExpandedContent(id, isCustom)}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                );
            })}

            {/* Ungrouped kanji */}
            {(() => {
                const ungroupedIds = allTargetPool.filter(id => {
                    if (groups.some(g => g.memberIds.includes(id))) return false;
                    if (!goalSearch.trim()) return true;
                    return matchesSearch(id);
                });
                return (
                    <>
                        {groups.length > 0 && ungroupedIds.length > 0 && (
                            <div className="text-xs text-gray-700 uppercase tracking-widest mb-1">Ungrouped</div>
                        )}
                        {ungroupedIds.map(id => {
                            const def = lookupTile(id);
                            if (!def) return null;
                            const isCurrent = id === targetId;
                            const isCustom = id.startsWith('custom_');
                            const isExpanded = expandedKanjiId === id;
                            return (
                                <div key={id} className={`rounded transition-colors ${isCurrent ? 'opacity-100' : 'opacity-50'} ${isExpanded || editingKanjiId === id ? 'bg-gray-800/60' : ''}`}>
                                    <div className="flex items-center gap-1 py-0.5 cursor-pointer"
                                        onClick={() => setExpandedKanjiId(isExpanded ? null : id)}>
                                        <span className="flex-shrink-0 flex items-center justify-center font-bold"
                                            style={{ width: 24, height: 24, fontSize: 14, fontFamily: 'serif', background: def.color, color: def.textColor, borderRadius: 6, boxShadow: isCurrent ? `0 0 10px ${def.glow}` : 'none', outline: isCurrent ? `2px solid ${def.glow}` : 'none' }}
                                        >{def.char}</span>
                                        <span className="text-xs text-gray-400 leading-tight truncate flex-1">{def.meaning}</span>
                                        {isCustom && (
                                            <button onClick={e => { e.stopPropagation(); startEdit(id); }}
                                                className="flex-shrink-0 text-yellow-500 hover:text-yellow-300 text-xs"
                                                title="Edit kanji"
                                            >✎</button>
                                        )}
                                        <span className="text-gray-700 text-xs flex-shrink-0">{isExpanded ? '▲' : '▼'}</span>
                                        {groups.length > 0 && (
                                            <button
                                                onClick={e => { e.stopPropagation(); setAssigningKanjiId(id === assigningKanjiId ? null : id); }}
                                                className="flex-shrink-0 text-gray-700 hover:text-gray-400 text-xs"
                                                title="Assign to group"
                                            >⊞</button>
                                        )}
                                        {isCustom && (
                                            confirmDeleteKanji === id ? (
                                                <span className="flex items-center gap-1 flex-shrink-0">
                                                    <span className="text-gray-500 text-xs">Sure?</span>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); onDeleteCustomKanji(id); setConfirmDeleteKanji(null); }}
                                                        className="text-red-400 hover:text-red-300 text-xs font-bold"
                                                    >✓</button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setConfirmDeleteKanji(null); }}
                                                        className="text-gray-500 hover:text-gray-300 text-xs font-bold"
                                                    >✗</button>
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={e => { e.stopPropagation(); setConfirmDeleteKanji(id); }}
                                                    className="flex-shrink-0 text-gray-700 hover:text-red-400 text-xs"
                                                    title="Remove from list"
                                                >✕</button>
                                            )
                                        )}
                                    </div>
                                    {assigningKanjiId === id && renderAssignPopover(id)}
                                    {(isExpanded || editingKanjiId === id) && renderExpandedContent(id, isCustom)}
                                </div>
                            );
                        })}
                    </>
                );
            })()}
            </div>
        </div>
    );
};

export default GoalsPanel;
