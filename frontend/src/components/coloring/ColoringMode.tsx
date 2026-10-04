import React, { useEffect, useState } from 'react';
import { ref, listAll, getDownloadURL, uploadBytes } from 'firebase/storage';
import { storage } from '../../firebase';
import { ColoringCanvas } from './ColoringCanvas';

const COLORING_FOLDER = 'coloring-pages';
const SAVES_FOLDER = 'coloring-saves';

interface ColoringPage {
    name: string;
    path: string;
    url: string;
}

export interface ColoringModeProps {
    uid?: string | null;
    subfolder?: string;
    onClose: () => void;
}

export const ColoringMode: React.FC<ColoringModeProps> = ({ uid, subfolder, onClose }) => {
    const [phase, setPhase] = useState<'browse' | 'coloring'>('browse');
    const [pages, setPages] = useState<ColoringPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [selected, setSelected] = useState<ColoringPage | null>(null);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const activeFolder = subfolder ? `${COLORING_FOLDER}/${subfolder}` : COLORING_FOLDER;

    // ─── List all images in the coloring-pages folder ─────────────────
    useEffect(() => {
        setLoading(true);
        setLoadError(false);
        const folderRef = ref(storage, activeFolder);
        listAll(folderRef)
            .then(async result => {
                const resolved = await Promise.all(
                    result.items.map(async item => {
                        const url = await getDownloadURL(item);
                        return { name: item.name, path: item.fullPath, url };
                    })
                );
                // Sort alphabetically by name
                resolved.sort((a, b) => a.name.localeCompare(b.name));
                setPages(resolved);
            })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, []);

    // ─── Save completed coloring to Storage ──────────────────────────
    const handleSaveBlob = async (blob: Blob) => {
        if (!uid || !selected) return;
        setSaveError(null);
        const filename = selected.name.replace(/\.[^/.]+$/, '');
        const savePath = `${SAVES_FOLDER}/${uid}/${filename}-${Date.now()}.png`;
        try {
            await uploadBytes(ref(storage, savePath), blob);
            setSavedMsg('Saved!');
            setTimeout(() => setSavedMsg(null), 2500);
        } catch {
            setSaveError('Save failed. Check storage rules.');
            setTimeout(() => setSaveError(null), 4000);
        }
    };

    // ─── Browse phase ─────────────────────────────────────────────────
    if (phase === 'browse') {
        return (
            <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center p-6 overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
                >
                    ✕
                </button>

                <h1 className="text-3xl font-bold text-white mt-4 mb-1">Coloring Pages</h1>
                <p className="text-gray-400 text-sm mb-8 text-center">
                    Click any page to start coloring
                </p>

                {loading && (
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-fuchsia-400 rounded-full animate-spin mt-12" />
                )}

                {!loading && loadError && (
                    <div className="text-gray-500 text-sm text-center mt-12">
                        <p className="text-red-400 font-bold mb-2">Could not load pages</p>
                        <p>Check Firebase Storage rules or network access.</p>
                    </div>
                )}

                {!loading && !loadError && pages.length === 0 && (
                    <div className="text-center max-w-sm mt-12">
                        <p className="text-gray-400 mb-3">No coloring pages found.</p>
                        <p className="text-gray-600 text-sm">
                            Upload PNG drawings to{' '}
                            <code className="text-fuchsia-400">coloring-pages/</code> in Firebase
                            Storage and they will appear here automatically.
                        </p>
                    </div>
                )}

                {!loading && !loadError && pages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 w-full max-w-4xl">
                        {pages.map(page => (
                            <button
                                key={page.path}
                                onClick={() => {
                                    setSelected(page);
                                    setPhase('coloring');
                                }}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-gray-700 bg-gray-900 hover:border-fuchsia-500 hover:bg-fuchsia-900/10 transition-all group"
                            >
                                {/* Thumbnail */}
                                <div className="w-full aspect-square bg-white rounded-lg overflow-hidden flex items-center justify-center">
                                    <img
                                        src={page.url}
                                        alt={page.name}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                    />
                                </div>
                                {/* Name */}
                                <span className="text-sm text-gray-400 group-hover:text-fuchsia-300 truncate w-full text-center">
                                    {page.name.replace(/\.[^/.]+$/, '')}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // ─── Coloring phase ───────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0 z-10">
                <button
                    onClick={() => setPhase('browse')}
                    className="text-gray-400 hover:text-white text-sm"
                >
                    ← Pages
                </button>
                <span className="text-gray-300 text-sm font-medium">
                    {selected?.name.replace(/\.[^/.]+$/, '')}
                </span>
                <div className="flex items-center gap-3">
                    {savedMsg && (
                        <span className="text-cyan-400 text-sm animate-pulse">{savedMsg}</span>
                    )}
                    {saveError && (
                        <span className="text-red-400 text-xs">{saveError}</span>
                    )}
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-white text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Canvas fills remaining space */}
            <div className="flex-1 min-h-0">
                {selected && (
                    <ColoringCanvas
                        imageUrl={selected.url}
                        onSaveBlob={uid ? handleSaveBlob : undefined}
                    />
                )}
            </div>
        </div>
    );
};
