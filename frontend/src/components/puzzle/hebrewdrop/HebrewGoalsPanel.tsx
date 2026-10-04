/**
 * HebrewGoalsPanel — Vocab word manager for HebrewDrop.
 * Modelled after GoalsPanel.tsx (KanjiDrop).
 *
 * Users type/paste a Hebrew word; the recipe is auto-derived from the
 * characters (up to 4 letters: anchor + 3 required neighbors).
 * Groups organise words into themed sets.
 */

import React, { useState } from 'react';
import { CHAR_TO_LETTER, LETTER_MAP } from '../HebrewDropData';
import { HB_RUNTIME_MERGE_MAP } from './hebrewDropTypes';
import type { HebrewVocabEntry } from '../../../services/hebrewDropService';
import type { GoalGroup } from './hebrewDropTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Recipe = { letters: string[]; xp: number };

/** Parse a Hebrew word string into letter IDs using CHAR_TO_LETTER. */
function parseWord(word: string): { ids: string[]; unknown: string[] } {
    const ids: string[] = [];
    const unknown: string[] = [];
    for (const ch of word) {
        const def = CHAR_TO_LETTER[ch];
        if (def) ids.push(def.id);
        else if (ch.trim()) unknown.push(ch);
    }
    return { ids, unknown };
}

/** Build a recipe from an array of letter IDs (ordered, Hebrew word order = RTL). */
function idsToRecipe(ids: string[], xp: number): Recipe {
    return { letters: ids, xp };
}

/** Small coloured letter chip */
const LetterChip: React.FC<{ id: string }> = ({ id }) => {
    const def = LETTER_MAP[id];
    if (!def) return <span className="text-gray-600 italic text-xs">{id}</span>;
    return (
        <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-lg font-bold"
            style={{ background: def.color, color: def.textColor, boxShadow: `0 0 6px ${def.glow}60` }}
        >
            {def.char}
        </span>
    );
};

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
    allVocabIds: string[];
    targetId: string;
    groups: GoalGroup[];
    vocabWords: HebrewVocabEntry[];
    onSaveGroups: (updated: GoalGroup[]) => void;
    onAddVocab: (char: string, meaning: string, translit: string, recipe?: Recipe) => string;
    onDeleteVocab: (id: string) => void;
    onUpdateVocab: (id: string, char: string, meaning: string, translit: string, recipe?: Recipe) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

const HebrewGoalsPanel: React.FC<Props> = ({
    allVocabIds, targetId, groups, vocabWords,
    onSaveGroups, onAddVocab, onDeleteVocab, onUpdateVocab,
}) => {
    // ── Group UI state ────────────────────────────────────────────────────────
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    // ── Add-vocab UI state ────────────────────────────────────────────────────
    const [isAddingWord, setIsAddingWord] = useState(false);
    const [newChar, setNewChar] = useState('');
    const [newMeaning, setNewMeaning] = useState('');
    const [newTranslit, setNewTranslit] = useState('');
    const [newXP, setNewXP] = useState(300);
    const [newWordGroup, setNewWordGroup] = useState<string | null>(null);
    const [addError, setAddError] = useState<string | null>(null);

    // ── Edit state ────────────────────────────────────────────────────────────
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editFields, setEditFields] = useState<{
        char: string; meaning: string; translit: string; xp: number;
    } | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    // ── Misc UI state ─────────────────────────────────────────────────────────
    const [assigningId, setAssigningId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    // ── Group helpers ─────────────────────────────────────────────────────────

    const toggleGroupOpen = (groupId: string) =>
        onSaveGroups(groups.map(g => g.id === groupId ? { ...g, open: !g.open } : g));

    const addGroup = () => {
        if (!newGroupName.trim()) return;
        onSaveGroups([...groups, { id: Date.now().toString(), name: newGroupName.trim(), memberIds: [], open: true }]);
        setNewGroupName('');
        setIsAddingGroup(false);
    };

    const toggleMembership = (wordId: string, groupId: string) => {
        onSaveGroups(groups.map(g => g.id !== groupId ? g : {
            ...g,
            memberIds: g.memberIds.includes(wordId)
                ? g.memberIds.filter(m => m !== wordId)
                : [...g.memberIds, wordId],
        }));
        setAssigningId(null);
    };

    // ── Vocab add/edit helpers ────────────────────────────────────────────────

    /** Build recipe and check for duplicates. Returns null on error (sets addError). */
    const buildAndValidate = (char: string, xp: number, excludeId?: string): Recipe | null | 'no-recipe' => {
        const { ids, unknown } = parseWord(char);
        if (ids.length === 0) { setAddError('No recognisable Hebrew letters found.'); return null; }
        if (unknown.length > 0) { setAddError(`Unrecognised characters: ${unknown.join(' ')} — remove nikkud or spaces.`); return null; }
        if (ids.length > 7) { setAddError(`Word has ${ids.length} letters. Max supported is 7.`); return null; }
        if (ids.length === 1) return 'no-recipe'; // single letter — no recipe needed

        const recipe = idsToRecipe(ids, xp);
        const key = recipe.letters.join(',');
        const keyRev = [...recipe.letters].reverse().join(',');
        const dupeInMap = HB_RUNTIME_MERGE_MAP.has(key) || HB_RUNTIME_MERGE_MAP.has(keyRev);
        const dupeInWords = vocabWords.some(e => {
            if (e.id === excludeId || !e.recipe) return false;
            const eKey = e.recipe.letters.join(',');
            const eKeyRev = [...e.recipe.letters].reverse().join(',');
            return key === eKey || key === eKeyRev || keyRev === eKey;
        });
        if (dupeInMap || dupeInWords) { setAddError('Duplicate recipe — another word uses the same letter sequence.'); return null; }
        return recipe;
    };

    const handleAddWord = () => {
        const char = newChar.trim();
        const meaning = newMeaning.trim();
        if (!char) { setAddError('Enter a Hebrew word.'); return; }
        if (!meaning) { setAddError('Enter a meaning.'); return; }

        const result = buildAndValidate(char, newXP);
        if (result === null) return; // error already set
        setAddError(null);

        const recipe = result === 'no-recipe' ? undefined : result;
        const newId = onAddVocab(char, meaning, newTranslit.trim(), recipe);
        if (newWordGroup) toggleMembership(newId, newWordGroup);
        setNewChar(''); setNewMeaning(''); setNewTranslit(''); setNewXP(300); setNewWordGroup(null);
        setIsAddingWord(false);
    };

    const startEdit = (id: string) => {
        const e = vocabWords.find(v => v.id === id);
        if (!e) return;
        setEditingId(id);
        setEditFields({ char: e.char, meaning: e.meaning, translit: e.transliteration, xp: e.recipe?.xp ?? 300 });
        setEditError(null);
    };

    const saveEdit = () => {
        if (!editingId || !editFields) return;
        const { char, meaning, translit, xp } = editFields;
        if (!char.trim() || !meaning.trim()) return;
        setEditError(null);
        const result = buildAndValidate(char.trim(), xp, editingId);
        if (result === null) { setEditError(addError); setAddError(null); return; }
        const recipe = result === 'no-recipe' ? undefined : result;
        onUpdateVocab(editingId, char.trim(), meaning.trim(), translit.trim(), recipe);
        setEditingId(null); setEditFields(null);
    };

    // ── Recipe preview chip row ────────────────────────────────────────────────

    const RecipePreview: React.FC<{ char: string }> = ({ char }) => {
        if (!char.trim()) return null;
        const { ids, unknown } = parseWord(char.trim());
        if (ids.length === 0) return null;
        return (
            <div className="flex flex-wrap items-center gap-1 mt-1">
                <span className="text-gray-500 text-xs">Recipe:</span>
                <LetterChip id={ids[0]} />
                {ids.slice(1).map((id, i) => (
                    <React.Fragment key={i}>
                        <span className="text-gray-600 text-xs">+</span>
                        <LetterChip id={id} />
                    </React.Fragment>
                ))}
                {unknown.length > 0 && <span className="text-red-400 text-xs ml-1">(unknown: {unknown.join(' ')})</span>}
                {ids.length > 7 && <span className="text-amber-400 text-xs ml-1">⚠ max 7 letters</span>}
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const filtered = vocabWords.filter(w =>
        !search ||
        w.char.includes(search) ||
        w.meaning.toLowerCase().includes(search.toLowerCase()) ||
        w.transliteration.toLowerCase().includes(search.toLowerCase())
    );

    const ungroupedIds = allVocabIds.filter(id => !groups.some(g => g.memberIds.includes(id)));
    const ungroupedWords = filtered.filter(w => ungroupedIds.includes(w.id));

    const inputCls = 'w-full px-2 py-1 text-xs bg-gray-900 text-white rounded border border-gray-700 outline-none focus:border-amber-600';
    const btnSm = (active?: boolean) =>
        `text-xs px-2 py-0.5 rounded border transition-all ${active
            ? 'bg-amber-800/50 border-amber-600 text-amber-200'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`;

    return (
        <div className="flex flex-col h-full overflow-hidden text-xs">

            {/* Search */}
            <div className="shrink-0 px-1 pb-2">
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search words…"
                    className={inputCls}
                />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">

                {/* ── Add-word form ──────────────────────────────────────── */}
                {isAddingWord ? (
                    <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-2 space-y-1.5">
                        <div className="font-semibold text-amber-300">New Vocab Word</div>

                        <div>
                            <label className="text-gray-500 text-xs">Hebrew word (paste or type)</label>
                            <input
                                value={newChar}
                                onChange={e => { setNewChar(e.target.value); setAddError(null); }}
                                placeholder="e.g. מלך"
                                dir="rtl"
                                className={inputCls + ' text-base'}
                                style={{ fontFamily: 'serif' }}
                            />
                            <RecipePreview char={newChar} />
                        </div>

                        <div className="grid grid-cols-2 gap-1">
                            <div>
                                <label className="text-gray-500">Meaning *</label>
                                <input value={newMeaning} onChange={e => setNewMeaning(e.target.value)}
                                    placeholder="king" className={inputCls} />
                            </div>
                            <div>
                                <label className="text-gray-500">Transliteration</label>
                                <input value={newTranslit} onChange={e => setNewTranslit(e.target.value)}
                                    placeholder="melek" className={inputCls} />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-gray-500">XP</label>
                            <input type="number" value={newXP} min={10} max={9999}
                                onChange={e => setNewXP(Number(e.target.value))}
                                className="w-20 px-2 py-0.5 text-xs bg-gray-900 text-white rounded border border-gray-700 outline-none focus:border-amber-600" />
                        </div>

                        {groups.length > 0 && (
                            <div>
                                <label className="text-gray-500">Group (optional)</label>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                    {groups.map(g => (
                                        <button key={g.id} onClick={() => setNewWordGroup(prev => prev === g.id ? null : g.id)}
                                            className={btnSm(newWordGroup === g.id)}>{g.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {addError && <p className="text-red-400">{addError}</p>}

                        <div className="flex gap-1.5 pt-0.5">
                            <button onClick={handleAddWord}
                                className="flex-1 py-1 bg-amber-700 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors">
                                Save
                            </button>
                            <button onClick={() => { setIsAddingWord(false); setAddError(null); setNewChar(''); setNewMeaning(''); setNewTranslit(''); }}
                                className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsAddingWord(true)}
                        className="w-full py-1.5 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-amber-400 hover:border-amber-700 transition-colors"
                    >
                        + Add Vocab Word
                    </button>
                )}

                {/* ── Add-group form ─────────────────────────────────────── */}
                {isAddingGroup ? (
                    <div className="flex gap-1.5">
                        <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addGroup(); }}
                            placeholder="Group name" autoFocus className={inputCls + ' flex-1'} />
                        <button onClick={addGroup} className="px-2 py-0.5 bg-amber-700 text-white rounded text-xs">Add</button>
                        <button onClick={() => { setIsAddingGroup(false); setNewGroupName(''); }}
                            className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded text-xs">✕</button>
                    </div>
                ) : (
                    <button onClick={() => setIsAddingGroup(true)}
                        className="text-gray-600 hover:text-amber-400 transition-colors w-full text-left pl-1">
                        + Add Group
                    </button>
                )}

                {/* ── Group sections ─────────────────────────────────────── */}
                {groups.map(group => {
                    const groupWords = filtered.filter(w => group.memberIds.includes(w.id));
                    return (
                        <div key={group.id} className="border border-gray-800 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-900/60">
                                <button onClick={() => toggleGroupOpen(group.id)}
                                    className="text-gray-500 w-3 shrink-0 text-center"
                                    style={{ fontSize: 9 }}>{group.open ? '▼' : '▶'}</button>
                                <span className="font-semibold text-gray-300 flex-1 truncate">{group.name}</span>
                                <span className="text-gray-600">{group.memberIds.length}</span>
                                {confirmDeleteGroup === group.id ? (
                                    <>
                                        <button onClick={() => onSaveGroups(groups.filter(g => g.id !== group.id))}
                                            className="text-red-400 hover:text-red-300 text-xs">del</button>
                                        <button onClick={() => setConfirmDeleteGroup(null)}
                                            className="text-gray-600 hover:text-gray-400 text-xs">keep</button>
                                    </>
                                ) : (
                                    <button onClick={() => setConfirmDeleteGroup(group.id)}
                                        className="text-gray-700 hover:text-red-400 text-xs ml-1">✕</button>
                                )}
                            </div>
                            {group.open && groupWords.map(w => renderWordRow(w, group.id))}
                        </div>
                    );
                })}

                {/* ── Ungrouped words ─────────────────────────────────────── */}
                {ungroupedWords.length > 0 && (
                    <div className="space-y-0.5">
                        <div className="text-gray-600 uppercase tracking-widest pl-1 pb-0.5" style={{ fontSize: 9 }}>
                            Ungrouped
                        </div>
                        {ungroupedWords.map(w => renderWordRow(w, null))}
                    </div>
                )}

                {vocabWords.length === 0 && !isAddingWord && (
                    <p className="text-center text-gray-600 py-4">
                        No vocab words yet. Click "+ Add Vocab Word" above!
                    </p>
                )}
            </div>
        </div>
    );

    // ── Word row renderer (defined inside to access local state) ──────────────

    function renderWordRow(word: HebrewVocabEntry, groupId: string | null) {
        const isTarget = word.id === targetId;
        const isExpanded = expandedId === word.id;
        const isEditing = editingId === word.id;
        const { ids } = parseWord(word.char);

        return (
            <div key={word.id}
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${isTarget ? 'bg-amber-900/30 border border-amber-700/50' : 'hover:bg-gray-800/50'}`}
                onClick={() => !isEditing && setExpandedId(prev => prev === word.id ? null : word.id)}
            >
                <div className="flex items-center gap-1.5">
                    {/* Hebrew word */}
                    <span dir="rtl" className="text-base font-bold text-amber-200 min-w-[2.5rem] text-right"
                        style={{ fontFamily: 'serif' }}>
                        {word.char}
                    </span>
                    <div className="flex-1 min-w-0">
                        <div className="text-gray-200 truncate">{word.meaning}</div>
                        {word.transliteration && (
                            <div className="text-gray-500 italic truncate">{word.transliteration}</div>
                        )}
                    </div>
                    {isTarget && <span className="text-amber-400 shrink-0">★</span>}
                    {/* Group assign */}
                    {assigningId === word.id ? (
                        <div className="flex flex-col gap-0.5 ml-1"
                            onClick={e => e.stopPropagation()}>
                            {groups.map(g => (
                                <button key={g.id}
                                    onClick={() => toggleMembership(word.id, g.id)}
                                    className={`text-xs px-1.5 py-0.5 rounded truncate ${g.memberIds.includes(word.id) ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-300'}`}>
                                    {g.memberIds.includes(word.id) ? '✓ ' : ''}{g.name}
                                </button>
                            ))}
                            <button onClick={() => setAssigningId(null)}
                                className="text-gray-600 text-xs">✕</button>
                        </div>
                    ) : null}
                </div>

                {/* Expanded detail */}
                {isExpanded && !isEditing && (
                    <div className="mt-1 space-y-1" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1 items-center">
                            {ids.map((id, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && <span className="text-gray-600">+</span>}
                                    <LetterChip id={id} />
                                    <span className="text-gray-500">{LETTER_MAP[id]?.name}</span>
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="text-gray-600">XP: {word.recipe?.xp ?? '—'}</div>
                        <div className="flex gap-1.5 mt-1">
                            {groups.length > 0 && (
                                <button onClick={() => setAssigningId(word.id)}
                                    className={btnSm()}>Assign group</button>
                            )}
                            <button onClick={() => startEdit(word.id)}
                                className={btnSm()}>Edit</button>
                            {confirmDeleteId === word.id ? (
                                <>
                                    <button onClick={() => onDeleteVocab(word.id)}
                                        className="text-xs px-2 py-0.5 bg-red-800 text-white rounded">Delete</button>
                                    <button onClick={() => setConfirmDeleteId(null)}
                                        className={btnSm()}>Keep</button>
                                </>
                            ) : (
                                <button onClick={() => setConfirmDeleteId(word.id)}
                                    className={btnSm()}>Delete</button>
                            )}
                        </div>
                    </div>
                )}

                {/* Edit form */}
                {isEditing && editFields && (
                    <div className="mt-1 space-y-1" onClick={e => e.stopPropagation()}>
                        <input value={editFields.char} dir="rtl"
                            onChange={e => setEditFields(f => f ? { ...f, char: e.target.value } : f)}
                            className={inputCls + ' text-base'} style={{ fontFamily: 'serif' }} />
                        <RecipePreview char={editFields.char} />
                        <div className="grid grid-cols-2 gap-1">
                            <input value={editFields.meaning}
                                onChange={e => setEditFields(f => f ? { ...f, meaning: e.target.value } : f)}
                                placeholder="Meaning" className={inputCls} />
                            <input value={editFields.translit}
                                onChange={e => setEditFields(f => f ? { ...f, translit: e.target.value } : f)}
                                placeholder="Transliteration" className={inputCls} />
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500">XP</span>
                            <input type="number" value={editFields.xp} min={10} max={9999}
                                onChange={e => setEditFields(f => f ? { ...f, xp: Number(e.target.value) } : f)}
                                className="w-16 px-2 py-0.5 text-xs bg-gray-900 text-white rounded border border-gray-700 outline-none" />
                        </div>
                        {editError && <p className="text-red-400">{editError}</p>}
                        <div className="flex gap-1.5">
                            <button onClick={saveEdit}
                                className="flex-1 py-0.5 bg-amber-700 text-white rounded text-xs font-bold">Save</button>
                            <button onClick={() => { setEditingId(null); setEditFields(null); setEditError(null); }}
                                className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs">Cancel</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
};

export default HebrewGoalsPanel;
