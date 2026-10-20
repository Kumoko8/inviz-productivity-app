import React, { useEffect, useMemo, useState } from 'react';
import PixelSprite from './pixels/PixelSprite';
import PixelCanvasEditor from './PixelCanvasEditor';
import { slugify } from '../services/pixelRegistryService';
import {
    JOURNAL_STORAGE_PATH,
    JournalCreature,
    JournalEntry,
    createJournalCreature,
    removeEntryCreature,
    setEntryCreatureCount,
    subscribeJournalCreatures,
    subscribeJournalEntries,
} from '../services/pixelJournalService';

type Props = { onClose: () => void };

const EXPECTED_SIZE = 32;

const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Parse as a local date so the label doesn't shift a day in negative UTC offsets.
const formatDate = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

const readDimensions = (file: File) => new Promise<{ w: number; h: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('not an image')); URL.revokeObjectURL(url); };
    img.src = url;
});

const PixelJournal: React.FC<Props> = ({ onClose }) => {
    const [creatures, setCreatures] = useState<JournalCreature[]>([]);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [date, setDate] = useState(todayKey());

    const [existingId, setExistingId] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [name, setName] = useState('');
    const [count, setCount] = useState(1);
    const [files, setFiles] = useState<File[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [showCanvas, setShowCanvas] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const u1 = subscribeJournalCreatures(setCreatures);
        const u2 = subscribeJournalEntries(setEntries);
        return () => { u1(); u2(); };
    }, []);

    const byId = useMemo(() => new Map(creatures.map(c => [c.id, c])), [creatures]);
    const sortedEntries = useMemo(() => entries.slice().sort((a, b) => b.date.localeCompare(a.date)), [entries]);
    const entry = entries.find(e => e.date === date);
    const entryIds = Object.keys(entry?.creatures ?? {});
    const addable = creatures.filter(c => !entryIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
    const cleanId = useMemo(() => slugify(name), [name]);
    const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
    useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);

    const run = async (fn: () => Promise<void>, fallback: string) => {
        setError(null);
        setBusy(true);
        try { await fn(); } catch (e: any) { setError(e?.message || fallback); } finally { setBusy(false); }
    };

    const addExisting = () => run(async () => {
        if (!existingId) return;
        await setEntryCreatureCount(date, existingId, 1);
        setExistingId('');
    }, 'Could not add the creature.');

    const changeCount = (id: string, next: number) => run(
        () => next <= 0 ? removeEntryCreature(date, id) : setEntryCreatureCount(date, id, next),
        'Could not update the entry.'
    );

    const onPickFiles = async (list: FileList | null) => {
        const picked = Array.from(list ?? []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        const notes: string[] = [];
        for (const f of picked) {
            if (f.type !== 'image/png') { notes.push(`${f.name} is not a PNG.`); continue; }
            try {
                const { w, h } = await readDimensions(f);
                if (w !== EXPECTED_SIZE || h !== EXPECTED_SIZE) notes.push(`${f.name} is ${w}×${h}, expected ${EXPECTED_SIZE}×${EXPECTED_SIZE}.`);
            } catch {
                notes.push(`${f.name} could not be read.`);
            }
        }
        setWarnings(notes);
        setFiles(prev => [...prev, ...picked.filter(f => f.type === 'image/png')]);
    };

    const createAndAdd = () => run(async () => {
        if (!name.trim() || !cleanId) throw new Error('Enter a name.');
        if (byId.has(cleanId)) throw new Error(`"${cleanId}" already exists — add it from the existing list instead.`);
        if (files.length === 0) throw new Error('Draw or choose at least one PNG frame.');
        await createJournalCreature(cleanId, name.trim(), files);
        await setEntryCreatureCount(date, cleanId, Math.max(1, count));
        setName(''); setCount(1); setFiles([]); setWarnings([]); setShowNew(false);
    }, 'Upload failed.');

    const input = 'px-2 py-1 border rounded text-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex items-center">
                    <h2 className="text-lg font-bold flex-1">Pixel Journal</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>

                <section className="flex flex-col gap-3 border rounded p-3">
                    <label className="text-sm font-semibold flex items-center gap-2">
                        Date
                        <input type="date" className={input} value={date} onChange={e => e.target.value && setDate(e.target.value)} />
                    </label>

                    <div className="text-sm font-semibold">{formatDate(date)}</div>
                    {entryIds.length === 0 ? (
                        <div className="text-xs text-gray-500">No discoveries recorded for this date yet.</div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {entryIds.map(id => {
                                const n = entry!.creatures[id];
                                return (
                                    <div key={id} className="flex flex-col items-center gap-1 p-2 border rounded bg-gray-50">
                                        <PixelSprite id={id} basePath={JOURNAL_STORAGE_PATH} scale={2} fps={6} />
                                        <div className="text-xs font-medium text-center leading-tight">{byId.get(id)?.name ?? id}</div>
                                        <div className="flex items-center gap-1 text-xs">
                                            <button disabled={busy} onClick={() => changeCount(id, n - 1)} className="w-5 h-5 bg-gray-200 rounded" aria-label="Decrease">−</button>
                                            <span className="w-6 text-center">×{n}</span>
                                            <button disabled={busy} onClick={() => changeCount(id, n + 1)} className="w-5 h-5 bg-gray-200 rounded" aria-label="Increase">+</button>
                                        </div>
                                        <button disabled={busy} onClick={() => removeEntryCreature(date, id).catch(e => setError(e?.message || 'Could not remove.'))} className="text-[10px] text-red-600 underline">remove</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <select className={input} value={existingId} onChange={e => setExistingId(e.target.value)}>
                            <option value="">Add an existing creature…</option>
                            {addable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={addExisting} disabled={busy || !existingId} className="px-3 py-1 bg-teal-500 text-white rounded text-sm disabled:opacity-50">Add to {date}</button>
                        <button onClick={() => setShowNew(v => !v)} className="px-3 py-1 bg-pink-500 text-white rounded text-sm">{showNew ? 'Cancel new creature' : '+ New creature'}</button>
                    </div>

                    {showNew && (
                        <div className="flex flex-col gap-2 border-t pt-3">
                            <div className="flex flex-wrap gap-2 items-center">
                                <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ladybug" />
                                <label className="text-sm flex items-center gap-1">Seen
                                    <input type="number" min={1} className={`${input} w-16`} value={count} onChange={e => setCount(Number(e.target.value) || 1)} />
                                </label>
                                {name && cleanId !== name && <span className="text-xs text-gray-500">id: {cleanId}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <input type="file" accept="image/png" multiple onChange={e => { onPickFiles(e.target.files); e.target.value = ''; }} />
                                <button onClick={() => setShowCanvas(true)} className="px-2 py-1 bg-pink-500 text-white rounded text-sm">Pixel Canvas</button>
                                {files.length > 0 && <button onClick={() => { setFiles([]); setWarnings([]); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Clear</button>}
                            </div>
                            {previews.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {previews.map((src, i) => (
                                        <img key={src} src={src} alt={`frame ${i}`} style={{ width: 64, height: 64, imageRendering: 'pixelated' }} className="border bg-gray-100" />
                                    ))}
                                </div>
                            )}
                            {warnings.map(w => <div key={w} className="text-xs text-amber-700">{w}</div>)}
                            <button onClick={createAndAdd} disabled={busy || files.length === 0 || !cleanId} className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50">
                                {busy ? 'Uploading…' : `Upload ${files.length || ''} frame${files.length === 1 ? '' : 's'} & add to ${date}`}
                            </button>
                        </div>
                    )}
                    {error && <div className="text-sm text-red-600">{error}</div>}
                </section>

                <section>
                    <h3 className="font-semibold text-gray-800 border-b mb-2">Journal entries <span className="text-xs text-gray-500">({sortedEntries.length})</span></h3>
                    {sortedEntries.length === 0 && <div className="text-xs text-gray-500">No entries yet.</div>}
                    <div className="flex flex-col gap-3">
                        {sortedEntries.map(e => {
                            const ids = Object.keys(e.creatures);
                            if (ids.length === 0) return null;
                            return (
                                <div key={e.date} className={`border rounded p-2 ${e.date === date ? 'ring-2 ring-teal-300' : ''}`}>
                                    <button onClick={() => setDate(e.date)} className="text-sm font-semibold text-teal-700 hover:underline">{formatDate(e.date)}</button>
                                    <div className="mt-1 grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {ids.map(id => (
                                            <div key={id} className="flex flex-col items-center p-1 bg-gray-50 border rounded">
                                                <PixelSprite id={id} basePath={JOURNAL_STORAGE_PATH} scale={2} fps={6} />
                                                <div className="text-[11px] text-center leading-tight">{byId.get(id)?.name ?? id}{e.creatures[id] > 1 ? ` ×${e.creatures[id]}` : ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
            {showCanvas && (
                <PixelCanvasEditor
                    defaultName={cleanId || 'creature'}
                    frames={files}
                    onAddFrame={file => setFiles(prev => [...prev, file])}
                    onRemoveFrame={i => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    onClose={() => setShowCanvas(false)}
                />
            )}
        </div>
    );
};

export default PixelJournal;
