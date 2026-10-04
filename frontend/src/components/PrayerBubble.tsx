import React, { useEffect, useState } from 'react';
import MessageList from './MessageList';
import ToggleArrow from './ToggleArrow';
import FocusOverlay from './FocusOverlay';
import { auth } from '../firebase';
import { getDrawings, deleteDrawing } from '../services/drawingService';
import type { DrawingRecord } from '../services/drawingService';
import { DrawingCanvas } from './drawings/DrawingCanvas';

const PrayerBubble: React.FC<{
    characterId: string;
    disabled?: boolean;
    selectedCharacter?: any;
    setUserCharacters?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter?: (c: any) => Promise<any> | void;
    onPrayerLevelUp?: (bonusXp: number) => void;
}> = ({ characterId, disabled = false, selectedCharacter, setUserCharacters, saveCharacter, onPrayerLevelUp }) => {
    const uid = auth.currentUser?.uid;

    const [drawings, setDrawings] = useState<DrawingRecord[]>([]);
    const [showFocus, setShowFocus] = useState(false);
    const [prayerRefreshKey, setPrayerRefreshKey] = useState(0);
    const [showCanvas, setShowCanvas] = useState(false);
    const [viewingDrawing, setViewingDrawing] = useState<DrawingRecord | null>(null);
    const [showDrawings, setShowDrawings] = useState(false);
    const [drawingSearch, setDrawingSearch] = useState('');

    useEffect(() => {
        if (!uid || !characterId) return;
        getDrawings(uid, characterId).then(setDrawings).catch(console.error);
    }, [uid, characterId]);

    const handleSave = (record: DrawingRecord, _strokeCount?: number) => {
        setDrawings(prev => [record, ...prev]);
        setShowCanvas(false);
    };

    const handleDelete = async (drawingId: string, storagePath?: string) => {
        if (!uid) return;
        await deleteDrawing(uid, characterId, drawingId, storagePath);
        setDrawings(prev => prev.filter(d => d.id !== drawingId));
        setViewingDrawing(null);
    };

    return (
        <>
            <MessageList
                characterId={characterId}
                collectionName="prayers"
                title="Prayers"
                placeholder="Enter prayer..."
                defaultColor="#bde0fe"
                disabled={disabled}
                onFocus={() => setShowFocus(true)}
                refreshKey={prayerRefreshKey}
            />

            {/* Drawings section */}
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8 mx-auto min-w-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-cyan-700">Drawings</h2>
                    <div className="flex items-center gap-2">
                        {!disabled && uid && (
                            <button
                                onClick={() => setShowCanvas(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                ✏️ Draw
                            </button>
                        )}
                        <button
                            onClick={() => setShowDrawings(s => !s)}
                            aria-label={showDrawings ? 'Hide drawings' : `Show drawings (${drawings.length})`}
                            className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
                        >
                            <ToggleArrow open={showDrawings} size={18} />
                        </button>
                    </div>
                </div>

                {showDrawings && (
                    <>
                        {/* Search bar */}
                        <div className="mb-3">
                            <input
                                type="text"
                                value={drawingSearch}
                                onChange={e => setDrawingSearch(e.target.value)}
                                placeholder="Search by date (e.g. April, 2026)…"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                            />
                        </div>

                        {(() => {
                            const kw = drawingSearch.trim().toLowerCase();
                            const filtered = kw
                                ? drawings.filter(d => {
                                    const ds = new Date(d.date);
                                    return [
                                        ds.toLocaleString(),
                                        ds.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                                        ds.toLocaleDateString(),
                                    ].some(s => s.toLowerCase().includes(kw));
                                })
                                : drawings;

                            if (filtered.length === 0) {
                                return <p className="text-sm text-gray-400 italic">{kw ? 'No drawings match that date.' : 'No drawings yet.'}</p>;
                            }

                            return (
                                <div className="grid grid-cols-3 gap-2">
                                    {filtered.map(d => (
                                        <button
                                            key={d.id}
                                            onClick={() => setViewingDrawing(d)}
                                            className="flex flex-col items-center gap-1 group"
                                        >
                                            <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-cyan-400 transition-colors bg-white">
                                                <img
                                                    src={d.dataUrl}
                                                    alt={`Drawing ${new Date(d.date).toLocaleDateString()}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <span className="text-xs text-gray-400 group-hover:text-cyan-600">
                                                {new Date(d.date).toLocaleDateString()}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Drawing canvas overlay */}
            {showCanvas && uid && (
                <DrawingCanvas
                    uid={uid}
                    charId={characterId}
                    onSave={handleSave}
                    onClose={() => setShowCanvas(false)}
                />
            )}

            {showFocus && (
                <FocusOverlay
                    characterId={characterId}
                    selectedCharacter={selectedCharacter}
                    setUserCharacters={setUserCharacters}
                    saveCharacter={saveCharacter}
                    onPrayerLevelUp={onPrayerLevelUp}
                    onPrayerSaved={() => setPrayerRefreshKey(k => k + 1)}
                    onDrawingSaved={(record) => setDrawings(prev => [record, ...prev])}
                    onClose={() => setShowFocus(false)}
                />
            )}

            {/* Full-screen view overlay */}
            {viewingDrawing && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
                    onClick={() => setViewingDrawing(null)}
                >
                    <img
                        src={viewingDrawing.dataUrl}
                        alt=""
                        className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-4 mt-4" onClick={e => e.stopPropagation()}>
                        <span className="text-gray-400 text-sm">
                            {new Date(viewingDrawing.date).toLocaleString()}
                        </span>
                        <button
                            onClick={() => handleDelete(viewingDrawing.id!, viewingDrawing.storagePath)}
                            className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                        >
                            Delete
                        </button>
                        <button
                            onClick={() => setViewingDrawing(null)}
                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default PrayerBubble;

