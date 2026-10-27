import React, { useMemo, useState } from 'react';
import { RecipeView, TileSprite } from './BubbleParts';
import { newId, recipeKey, sectionTiles, type BubbleGroup, type BubbleRecipe, type BubbleTile } from './rainbowBubbleTypes';

interface Props {
    tiles: BubbleTile[];
    groups: BubbleGroup[];
    recipes: BubbleRecipe[];
    onSave: (recipe: BubbleRecipe) => void;
    onDelete: (id: string) => void;
}

const TileSelect: React.FC<{
    label: string;
    value: string;
    tiles: BubbleTile[];
    groups: BubbleGroup[];
    onChange: (id: string) => void;
    optional?: boolean;
}> = ({ label, value, tiles, groups, onChange, optional }) => {
    const tile = tiles.find(t => t.id === value);
    const sections = sectionTiles(tiles, groups);
    return (
        <div className="flex items-center gap-2">
            <span className="w-16 text-xs text-gray-500 flex-shrink-0">{label}</span>
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-950 border border-gray-800 flex-shrink-0">
                {tile && <TileSprite pixels={tile.pixels} size={28} />}
            </span>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="flex-1 min-w-0 text-xs bg-gray-950 text-white px-2 py-1.5 rounded border border-gray-700">
                <option value="">{optional ? '— none —' : 'Select a tile…'}</option>
                {groups.length === 0
                    ? tiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    : sections.map(sec => (
                        <optgroup key={sec.id || 'none'} label={sec.name}>
                            {sec.tiles.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </optgroup>
                    ))}
            </select>
        </div>
    );
};

interface Draft { id: string; a: string; ing: [string, string, string]; result: string; xp: number; }

const blankDraft = (): Draft => ({ id: newId('recipe'), a: '', ing: ['', '', ''], result: '', xp: 100 });

const RecipesPanel: React.FC<Props> = ({ tiles, groups, recipes, onSave, onDelete }) => {
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState('');
    const tileMap = useMemo(() => Object.fromEntries(tiles.map(t => [t.id, t])), [tiles]);

    const save = () => {
        if (!draft) return;
        const ingredients = draft.ing.filter(Boolean);
        if (!draft.a) { setError('Pick an anchor tile.'); return; }
        if (ingredients.length === 0) { setError('Add at least one ingredient.'); return; }
        if (!draft.result) { setError('Pick the result tile.'); return; }
        const key = recipeKey(draft.a, ingredients);
        if (recipes.some(r => r.id !== draft.id && recipeKey(r.a, r.ingredients) === key)) {
            setError('A recipe with these ingredients already exists.');
            return;
        }
        onSave({ id: draft.id, a: draft.a, ingredients, result: draft.result, xp: Math.max(0, Math.round(draft.xp) || 0) });
        setDraft(null);
        setError('');
    };

    const setIng = (i: number, v: string) =>
        setDraft(d => d && { ...d, ing: d.ing.map((x, k) => (k === i ? v : x)) as Draft['ing'] });

    return (
        <div className="w-full max-w-4xl mx-auto p-3 flex flex-col md:flex-row gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-widest flex-1">Your recipes ({recipes.length})</span>
                    <button onClick={() => { setDraft(blankDraft()); setError(''); }} disabled={tiles.length < 2}
                        className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white disabled:opacity-40">+ New recipe</button>
                </div>
                {tiles.length < 2 && (
                    <div className="text-sm text-gray-500 text-center py-10">Create at least two tiles before making recipes.</div>
                )}
                <div className="flex flex-col gap-2">
                    {recipes.map(r => (
                        <div key={r.id} className="p-2 rounded-xl border border-gray-800 bg-gray-900">
                            <RecipeView recipe={r} tiles={tileMap} />
                            <div className="flex justify-end gap-3 mt-1">
                                <button onClick={() => {
                                    setDraft({ id: r.id, a: r.a, ing: [r.ingredients[0] ?? '', r.ingredients[1] ?? '', r.ingredients[2] ?? ''], result: r.result, xp: r.xp });
                                    setError('');
                                }} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                                <button onClick={() => onDelete(r.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {draft && (
                <div className="md:w-[340px] flex-shrink-0 p-3 rounded-2xl border border-gray-800 bg-gray-900/80 flex flex-col gap-2 self-start">
                    <div className="text-xs text-gray-500 uppercase tracking-widest">Recipe</div>
                    <TileSelect label="Anchor" value={draft.a} tiles={tiles} groups={groups} onChange={v => setDraft(d => d && { ...d, a: v })} />
                    <TileSelect label="Needs" value={draft.ing[0]} tiles={tiles} groups={groups} onChange={v => setIng(0, v)} />
                    <TileSelect label="and" value={draft.ing[1]} tiles={tiles} groups={groups} onChange={v => setIng(1, v)} optional />
                    <TileSelect label="and" value={draft.ing[2]} tiles={tiles} groups={groups} onChange={v => setIng(2, v)} optional />
                    <TileSelect label="Makes" value={draft.result} tiles={tiles} groups={groups} onChange={v => setDraft(d => d && { ...d, result: v })} />
                    <div className="flex items-center gap-2">
                        <span className="w-16 text-xs text-gray-500">XP</span>
                        <input type="number" min={0} step={50} value={draft.xp}
                            onChange={e => setDraft(d => d && { ...d, xp: Number(e.target.value) })}
                            className="w-24 text-xs bg-gray-950 text-white px-2 py-1.5 rounded border border-gray-700" />
                    </div>
                    <div className="text-xs text-gray-600">
                        The anchor is the tile you place; the ingredients must be touching it (up, down, left, right).
                    </div>
                    {error && <div className="text-xs text-red-400">{error}</div>}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setDraft(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-300">Cancel</button>
                        <button onClick={save} className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white">Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecipesPanel;
