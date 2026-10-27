import React, { useState } from 'react';
import PixelEditor from './PixelEditor';
import { TileSprite } from './BubbleParts';
import { EMPTY_PIXELS, newId, sectionTiles, type BubbleGroup, type BubbleTile } from './rainbowBubbleTypes';

interface Props {
    tiles: BubbleTile[];
    groups: BubbleGroup[];
    onSave: (tile: BubbleTile) => void;
    onDelete: (id: string) => void;
    onSaveGroup: (group: BubbleGroup) => void;
    onDeleteGroup: (id: string) => void;
}

const TilesPanel: React.FC<Props> = ({ tiles, groups, onSave, onDelete, onSaveGroup, onDeleteGroup }) => {
    const [draft, setDraft] = useState<BubbleTile | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [error, setError] = useState('');
    // 'all' | '' (ungrouped) | group id
    const [filter, setFilter] = useState<string>('all');
    const [groupName, setGroupName] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<string | null>(null);

    const activeFilter = filter === 'all' || filter === '' || groups.some(g => g.id === filter) ? filter : 'all';
    const visibleTiles = tiles.filter(t => {
        if (activeFilter === 'all') return true;
        const inKnown = t.groupId && groups.some(g => g.id === t.groupId);
        return activeFilter === '' ? !inKnown : t.groupId === activeFilter;
    });
    const sections = sectionTiles(visibleTiles, groups);
    const filterGroup = groups.find(g => g.id === activeFilter);

    const commitGroup = () => {
        const name = (groupName ?? '').trim();
        if (name) {
            if (renamingId) onSaveGroup({ id: renamingId, name });
            else {
                const g = { id: newId('group'), name };
                onSaveGroup(g);
                setFilter(g.id);
            }
        }
        setGroupName(null);
        setRenamingId(null);
    };

    const startNew = () => {
        setDraft({
            id: newId('tile'), name: '', pixels: EMPTY_PIXELS, spawnable: true,
            groupId: filterGroup ? filterGroup.id : '',
        });
        setIsNew(true);
        setError('');
    };

    const save = () => {
        if (!draft) return;
        if (!draft.name.trim()) { setError('Give the tile a name.'); return; }
        if (draft.pixels === EMPTY_PIXELS) { setError('Draw something first.'); return; }
        onSave({ ...draft, name: draft.name.trim() });
        setDraft(null);
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-3 flex flex-col md:flex-row gap-4">
            <div className="flex-1 min-w-0">
                <div className="flex items-center mb-2">
                    <span className="text-xs text-gray-500 uppercase tracking-widest flex-1">Your tiles ({tiles.length})</span>
                    <button onClick={startNew}
                        className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white">+ New tile</button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {[{ id: 'all', name: 'All' }, ...groups, ...(groups.length ? [{ id: '', name: 'Ungrouped' }] : [])].map(g => (
                        <button key={g.id || 'none'} onClick={() => setFilter(g.id)}
                            className={`text-xs px-3 py-1 rounded-full border ${activeFilter === g.id ? 'bg-purple-700 border-purple-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'}`}>
                            {g.name}
                        </button>
                    ))}
                    {groupName === null ? (
                        <button onClick={() => { setGroupName(''); setRenamingId(null); }}
                            className="text-xs px-3 py-1 rounded-full border border-dashed border-gray-700 text-gray-500 hover:text-white">+ Group</button>
                    ) : (
                        <span className="flex items-center gap-1">
                            <input autoFocus value={groupName} maxLength={30} placeholder="Group name"
                                onChange={e => setGroupName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commitGroup(); if (e.key === 'Escape') { setGroupName(null); setRenamingId(null); } }}
                                className="text-xs bg-gray-950 text-white px-2 py-1 rounded border border-gray-700 outline-none focus:border-purple-400 w-28" />
                            <button onClick={commitGroup} className="text-xs text-gray-400 hover:text-white">✓</button>
                            <button onClick={() => { setGroupName(null); setRenamingId(null); }} className="text-xs text-gray-600 hover:text-gray-400">✕</button>
                        </span>
                    )}
                </div>
                {filterGroup && (
                    <div className="flex items-center gap-3 mb-2 text-xs">
                        <button onClick={() => { setRenamingId(filterGroup.id); setGroupName(filterGroup.name); }}
                            className="text-blue-400 hover:text-blue-300">Rename group</button>
                        {confirmDeleteGroup === filterGroup.id ? (
                            <span className="flex items-center gap-2 text-gray-400">
                                Tiles stay, just ungrouped.
                                <button onClick={() => { onDeleteGroup(filterGroup.id); setConfirmDeleteGroup(null); setFilter('all'); }}
                                    className="text-red-400 hover:text-red-300">Delete</button>
                                <button onClick={() => setConfirmDeleteGroup(null)} className="text-gray-500 hover:text-gray-300">Cancel</button>
                            </span>
                        ) : (
                            <button onClick={() => setConfirmDeleteGroup(filterGroup.id)} className="text-red-400 hover:text-red-300">Delete group</button>
                        )}
                    </div>
                )}
                {tiles.length === 0 && !draft && (
                    <div className="text-sm text-gray-500 text-center py-10">
                        No tiles yet. Create your first tile and draw it on the pixel canvas.
                    </div>
                )}
                {tiles.length > 0 && visibleTiles.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-8">No tiles in this group yet.</div>
                )}
                <div className="flex flex-col gap-4">
                    {sections.map(sec => (
                        <div key={sec.id || 'none'}>
                            {groups.length > 0 && activeFilter === 'all' && (
                                <div className="text-xs text-gray-500 uppercase tracking-widest mb-1.5">{sec.name} ({sec.tiles.length})</div>
                            )}
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {sec.tiles.map(t => (
                                    <button key={t.id}
                                        onClick={() => { setDraft({ ...t }); setIsNew(false); setError(''); }}
                                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border bg-gray-900 hover:bg-gray-800 ${draft?.id === t.id ? 'border-purple-400' : 'border-gray-800'}`}>
                                        <TileSprite pixels={t.pixels} size={48} />
                                        <span className="text-xs text-gray-300 truncate w-full text-center">{t.name}</span>
                                        {!t.spawnable && <span className="text-gray-600" style={{ fontSize: 9 }}>merge-only</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {draft && (
                <div className="md:w-[360px] flex-shrink-0 p-3 rounded-2xl border border-gray-800 bg-gray-900/80">
                    <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">{isNew ? 'New tile' : 'Edit tile'}</div>
                    <input
                        value={draft.name} maxLength={40} placeholder="Name (e.g. Water)"
                        onChange={e => setDraft(d => d && { ...d, name: e.target.value })}
                        className="w-full text-sm bg-gray-950 text-white px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-purple-400 mb-2" />
                    {groups.length > 0 && (
                        <select value={draft.groupId ?? ''} onChange={e => setDraft(d => d && { ...d, groupId: e.target.value })}
                            className="w-full text-xs bg-gray-950 text-white px-2 py-1.5 rounded border border-gray-700 mb-2">
                            <option value="">No group</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    )}
                    <PixelEditor pixels={draft.pixels} onChange={p => setDraft(d => d && { ...d, pixels: p })} />
                    <label className="flex items-center gap-2 text-xs text-gray-400 mt-3 cursor-pointer">
                        <input type="checkbox" checked={draft.spawnable}
                            onChange={e => setDraft(d => d && { ...d, spawnable: e.target.checked })} />
                        Available in the play palette (uncheck for merge-only tiles)
                    </label>
                    {error && <div className="text-xs text-red-400 mt-2">{error}</div>}
                    <div className="flex items-center gap-2 mt-3">
                        {!isNew && (
                            <button
                                onClick={() => {
                                    if (window.confirm(`Delete "${draft.name}" and every recipe that uses it?`)) {
                                        onDelete(draft.id);
                                        setDraft(null);
                                    }
                                }}
                                className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-300">Delete</button>
                        )}
                        <span className="flex-1" />
                        <button onClick={() => setDraft(null)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-300">Cancel</button>
                        <button onClick={save} className="text-xs px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white">Save</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TilesPanel;
