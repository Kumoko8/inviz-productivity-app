import React, { useEffect, useState } from 'react';
import ToggleArrow from './ToggleArrow';
import SearchBar from './SearchBar';
import { auth, db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { addItemToCharacter, updateItemForCharacter, deleteItemFromCharacter } from '../services/characterService';

interface Props {
    characterId: string;
    collectionName: string; // 'prayers' | 'notes'
    title?: string;
    placeholder?: string;
    defaultColor?: string;
    disabled?: boolean;
    titleClassName?: string;
    showSearch?: boolean;
    onFocus?: () => void;
    refreshKey?: number;
}

const defaultColors = ['#ee6d71', '#f7de26ff', '#c954a2', '#4899e0', '#54c97b', '#bde0fe', '#f6be32'];

const MessageList: React.FC<Props> = ({
    characterId,
    collectionName,
    title = 'Messages',
    placeholder = 'Enter text...',
    defaultColor = '#bde0fe',
    disabled = false,
    titleClassName,
    showSearch,
    onFocus,
    refreshKey,
}) => {
    const user = auth.currentUser;
    const uid = user?.uid;
    const [items, setItems] = useState<any[]>([]);
    const [newText, setNewText] = useState('');
    const [previewColor, setPreviewColor] = useState(defaultColor);
    const [showList, setShowList] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filterKeyword, setFilterKeyword] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (!uid || !characterId) return;

        const load = async () => {
            const ref = collection(db, 'users', uid, 'characters', characterId, collectionName);
            const snap = await getDocs(ref);
            const list = snap.docs.map((d) => {
                const data = d.data() as any;
                const createdAt = data?.createdAt && (typeof (data.createdAt) === 'object' && (data.createdAt as any).toMillis ? (data.createdAt as any).toMillis() : data.createdAt);
                return { id: d.id, ...data, createdAt };
            });
            setItems(list);
        };

        load().catch(console.error);
    }, [uid, characterId, collectionName, refreshKey]);

    const addItem = async () => {
        if (!uid || !characterId || !newText.trim()) return;
        const createdAt = Date.now();
        const id = await addItemToCharacter(uid, characterId, collectionName, { text: newText, color: previewColor });
        setItems((prev) => [{ id: id ?? 'new', text: newText, color: previewColor, createdAt }, ...prev]);
        setNewText('');
    };

    const updateColor = async (id: string, color: string) => {
        if (!uid || !characterId) return;
        await updateItemForCharacter(uid, characterId, collectionName, id, { color });
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, color } : i)));
    };

    const deleteItem = async (id: string) => {
        if (!uid || !characterId) return;
        await deleteItemFromCharacter(uid, characterId, collectionName, id);
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const startEdit = (id: string, text: string) => {
        setEditingId(id);
        setEditingText(text || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingText('');
    };

    const saveEdit = async (id: string) => {
        if (!uid || !characterId) return;
        try {
            await updateItemForCharacter(uid, characterId, collectionName, id, { text: editingText, updatedAt: Date.now() });
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, text: editingText } : i)));
        } catch (err) {
            console.error('Error saving edit', err);
        }
        setEditingId(null);
        setEditingText('');
    };

    const filtered = items.filter((p) => {
        if (filterKeyword && filterKeyword.trim()) {
            const kw = filterKeyword.trim().toLowerCase();
            const text = (p.text || '').toString().toLowerCase();
            const itemTitle = (p.title || '').toString().toLowerCase();
            const dateStr = p.createdAt
                ? [
                    new Date(p.createdAt).toLocaleString(),
                    new Date(p.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                ].join(' ').toLowerCase()
                : '';
            if (!text.includes(kw) && !itemTitle.includes(kw) && !dateStr.includes(kw)) return false;
        }
        return true;
    });

    return (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8 mx-auto min-w-0">
            <div className="flex items-center justify-between mb-4">
                <h2 className={titleClassName ?? 'text-2xl font-bold text-cyan-700'}>{title}</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowList((s) => !s)}
                        aria-label={showList ? `Hide ${title.toLowerCase()}` : `Show ${title.toLowerCase()} (${items.length})`}
                        className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
                    >
                        <ToggleArrow open={showList} size={18} />
                    </button>
                </div>
            </div>

            {showList && (
                <>


                    <div className="flex flex-col gap-3 mb-4">
                        <input
                            value={newText}
                            onChange={(e) => setNewText(e.target.value)}
                            placeholder={placeholder}
                            className="border rounded px-3 py-2 w-full"
                            style={{ backgroundColor: previewColor }}
                            disabled={disabled}
                        />

                        <div className="flex gap-2">
                            {defaultColors.map((c) => (
                                <button key={c} onClick={() => setPreviewColor(c)} style={{ backgroundColor: c }} className="w-8 h-8 rounded-full border" />
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={addItem} className="px-3 py-2 bg-cyan-500 text-white rounded" disabled={disabled}>
                            Add
                        </button>
                        {onFocus && (
                            <button onClick={onFocus} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded text-sm transition-colors">
                                Focus
                            </button>
                        )}
                        <button onClick={() => { setNewText(''); setPreviewColor(defaultColor); }} className="px-3 py-2 bg-gray-100 rounded">
                            Clear
                        </button>
                    </div>

                    {(showSearch ?? true) && (
                        <div className="my-3">
                            <SearchBar initialKeyword={filterKeyword ?? ''} initiallyCollapsed={true} placeholder={`Search ${title.toLowerCase()}...`} onChange={({ keyword }) => setFilterKeyword(keyword)} />
                        </div>
                    )}


                    <div className="flex flex-col gap-3">
                        {filtered.map((p: any) => (
                            <div key={p.id} className="p-3 rounded shadow flex items-start justify-between w-full min-w-0" style={{ backgroundColor: p.color }}>
                                <div className="flex-1 mr-3 min-w-0">
                                    {p.createdAt && (
                                        <div className="text-xs text-gray-500 mb-1">{new Date(p.createdAt).toLocaleString()}</div>
                                    )}

                                    {editingId === p.id ? (
                                        <>
                                            <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full border rounded px-2 py-1" rows={4} />

                                            <div className="flex gap-2 mt-2 sm:hidden">
                                                <button onClick={() => saveEdit(p.id)} className="px-2 py-1 bg-green-400 rounded">Save</button>
                                                <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
                                            </div>
                                        </>
                                    ) : (
                                        expandedId === p.id ? (
                                            <div className="whitespace-pre-wrap break-words">{p.text}</div>
                                        ) : (
                                            <div className="overflow-hidden truncate whitespace-nowrap break-words" title={p.text}>{p.text?.replace(/\n/g, ' ')}</div>
                                        )
                                    )}

                                    <div className="flex gap-2 mt-2 items-center">
                                        <div className="w-7 h-7 rounded-full overflow-hidden relative" style={{ background: 'conic-gradient(#ff006e,#ff8c00,#ffd300,#32d74b,#00c2ff,#7a5cff)' }}>
                                            <input type="color" value={p.color} onChange={(e) => updateColor(p.id, e.target.value)} className="absolute inset-0 w-full h-full p-0 m-0 opacity-0 cursor-pointer" aria-label={`Set color for ${title.toLowerCase()}`} disabled={disabled} />
                                        </div>
                                    </div>

                                </div>

                                <div className={`flex items-start gap-2 ml-3 ${editingId === p.id ? 'hidden sm:flex' : ''}`}>
                                    {editingId === p.id ? (
                                        <>
                                            <button onClick={() => saveEdit(p.id)} className="px-2 py-1 bg-green-400 rounded">Save</button>
                                            <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => startEdit(p.id, p.text)} className="px-2 py-1 bg-blue-200 rounded" disabled={disabled}>Edit</button>
                                            <button onClick={() => deleteItem(p.id)} className="text-red-600 font-bold" disabled={disabled}>✕</button>
                                            <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="px-2 py-1 text-sm text-cyan-700" aria-label="Toggle more">{expandedId === p.id ? 'Less' : 'More'}</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default MessageList;
