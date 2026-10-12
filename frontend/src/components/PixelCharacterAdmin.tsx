import React, { useMemo, useState } from 'react';
import usePixelRegistry from '../hooks/usePixelRegistry';
import { getCharacterGroups, getCharacterPool, PIXEL_RARITY_ORDER, PixelCharacterRarity, RARITY_COUNTS } from './pixels/pixelRegistry';
import PixelSprite from './pixels/PixelSprite';
import PixelCanvasEditor from './PixelCanvasEditor';
import { savePixelCharacter, savePixelGroup, slugify, uploadPixelFrames } from '../services/pixelRegistryService';

type Props = { onClose: () => void };

const NEW_GROUP = '__new__';
const EXPECTED_SIZE = 32;

const readDimensions = (file: File) => new Promise<{ w: number; h: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error('not an image')); URL.revokeObjectURL(url); };
    img.src = url;
});

const PixelCharacterAdmin: React.FC<Props> = ({ onClose }) => {
    usePixelRegistry();
    const groups = getCharacterGroups();

    const [step, setStep] = useState<'details' | 'upload' | 'done'>('details');
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [groupChoice, setGroupChoice] = useState<string>(Object.keys(groups)[0] ?? NEW_GROUP);
    const [newGroupLabel, setNewGroupLabel] = useState('');
    const [rarity, setRarity] = useState<PixelCharacterRarity>('common');
    const [files, setFiles] = useState<File[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [showCanvas, setShowCanvas] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cleanId = useMemo(() => slugify(id), [id]);
    const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);

    const submitDetails = async () => {
        setError(null);
        if (!cleanId) return setError('Enter an id.');
        if (!name.trim()) return setError('Enter a name.');
        if (getCharacterPool().some(c => c.id === cleanId)) return setError(`A character with id "${cleanId}" already exists.`);
        let groupId = groupChoice;
        if (groupChoice === NEW_GROUP) {
            groupId = slugify(newGroupLabel);
            if (!groupId) return setError('Enter a name for the new group.');
        }
        setBusy(true);
        try {
            if (groupChoice === NEW_GROUP && !groups[groupId]) await savePixelGroup(groupId, newGroupLabel.trim());
            await savePixelCharacter({ id: cleanId, name: name.trim(), group: groupId, rarity });
            setStep('upload');
        } catch (e: any) {
            setError(e?.message || 'Could not save the character.');
        } finally {
            setBusy(false);
        }
    };

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

    const upload = async () => {
        if (files.length === 0) return setError('Choose at least one PNG frame.');
        setBusy(true);
        setError(null);
        try {
            await uploadPixelFrames(cleanId, files);
            setStep('done');
        } catch (e: any) {
            setError(e?.message || 'Upload failed.');
        } finally {
            setBusy(false);
        }
    };

    const reset = () => {
        setStep('details'); setId(''); setName(''); setFiles([]); setWarnings([]); setError(null);
    };

    const input = 'w-full px-2 py-1 border rounded text-sm';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-full overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center">
                    <h2 className="text-lg font-bold flex-1">Add Pixel Character</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>

                {step === 'details' && (
                    <>
                        <label className="text-sm">Id
                            <input className={input} value={id} onChange={e => setId(e.target.value)} placeholder="e.g. golden-duck" />
                            {id && cleanId !== id && <span className="text-xs text-gray-500">Will be saved as "{cleanId}"</span>}
                        </label>
                        <label className="text-sm">Name
                            <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Golden Duck" />
                        </label>
                        <label className="text-sm">Group
                            <select className={input} value={groupChoice} onChange={e => setGroupChoice(e.target.value)}>
                                {Object.entries(groups).map(([gid, label]) => <option key={gid} value={gid}>{label}</option>)}
                                <option value={NEW_GROUP}>+ New group…</option>
                            </select>
                        </label>
                        {groupChoice === NEW_GROUP && (
                            <input className={input} value={newGroupLabel} onChange={e => setNewGroupLabel(e.target.value)} placeholder="New group name" />
                        )}
                        <label className="text-sm">Rarity
                            <select className={input} value={rarity} onChange={e => setRarity(e.target.value as PixelCharacterRarity)}>
                                {PIXEL_RARITY_ORDER.map(r => <option key={r} value={r}>{r} (drop weight {RARITY_COUNTS[r]})</option>)}
                            </select>
                        </label>
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        <button onClick={submitDetails} disabled={busy} className="px-3 py-2 bg-blue-500 text-white rounded disabled:opacity-50">
                            {busy ? 'Saving…' : 'Save & continue to upload'}
                        </button>
                        <button onClick={() => setShowCanvas(true)} disabled={busy} className="px-3 py-2 bg-pink-500 text-white rounded disabled:opacity-50">
                            Pixel Canvas{files.length > 0 ? ` (${files.length} frame${files.length === 1 ? '' : 's'} drawn)` : ''}
                        </button>
                    </>
                )}

                {step === 'upload' && (
                    <>
                        <div className="text-sm text-gray-700">
                            <b>{name}</b> was saved. Now upload its frames to Firebase Storage at
                            <code className="block bg-gray-100 px-1 rounded my-1">pixelCharacters/{cleanId}/frame_N.png</code>
                            Choose one or more {EXPECTED_SIZE}×{EXPECTED_SIZE} PNGs (they are numbered in filename order; one frame is a static sprite).
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="file" accept="image/png" multiple onChange={e => { onPickFiles(e.target.files); e.target.value = ''; }} />
                            <button onClick={() => setShowCanvas(true)} className="px-2 py-1 bg-pink-500 text-white rounded text-sm whitespace-nowrap">Pixel Canvas</button>
                            {files.length > 0 && <button onClick={() => { setFiles([]); setWarnings([]); }} className="px-2 py-1 bg-gray-200 rounded text-sm">Clear</button>}
                        </div>
                        <div className="text-xs text-gray-500">Frames are uploaded in the order shown (drawn frames first, then chosen files).</div>
                        {previews.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {previews.map((src, i) => (
                                    <img key={src} src={src} alt={`frame ${i}`} style={{ width: 64, height: 64, imageRendering: 'pixelated' }} className="border bg-gray-100" />
                                ))}
                            </div>
                        )}
                        {warnings.map(w => <div key={w} className="text-xs text-amber-700">{w}</div>)}
                        {error && <div className="text-sm text-red-600">{error}</div>}
                        <button onClick={upload} disabled={busy || files.length === 0} className="px-3 py-2 bg-green-600 text-white rounded disabled:opacity-50">
                            {busy ? 'Uploading…' : `Upload ${files.length || ''} frame${files.length === 1 ? '' : 's'}`}
                        </button>
                    </>
                )}

                {step === 'done' && (
                    <>
                        <div className="text-sm text-green-700">Uploaded! {name} is now in the pool.</div>
                        <div className="flex justify-center"><PixelSprite id={cleanId} scale={4} fps={6} /></div>
                        <div className="flex gap-2">
                            <button onClick={reset} className="flex-1 px-3 py-2 bg-blue-500 text-white rounded">Add another</button>
                            <button onClick={onClose} className="flex-1 px-3 py-2 bg-gray-200 rounded">Close</button>
                        </div>
                    </>
                )}
            </div>
            {showCanvas && (
                <PixelCanvasEditor
                    defaultName={cleanId}
                    frames={files}
                    onAddFrame={file => setFiles(prev => [...prev, file])}
                    onRemoveFrame={i => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                    onClose={() => setShowCanvas(false)}
                />
            )}
        </div>
    );
};

export default PixelCharacterAdmin;
