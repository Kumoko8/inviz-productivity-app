import React, { useEffect, useRef, useState } from 'react';
import { fetchAnimUrl } from '../utils/storageUtils';
import { DrawingCanvas } from './drawings/DrawingCanvas';
import type { DrawingRecord } from '../services/drawingService';
import { auth } from '../firebase';
import { addItemToCharacter } from '../services/characterService';
import {
    loadPrayerRequests,
    savePrayerRequests,
    type PrayerRequest,
} from '../services/prayerService';
import { focusAnimPath } from './focus/focusAnimUtils';
import { useFocusOrbs } from './focus/useFocusOrbs';
import { usePrayerAward } from './focus/usePrayerAward';
import { FocusOrbLayer } from './focus/FocusOrbLayer';
import { FocusPrayerBar } from './focus/FocusPrayerBar';
import { PrayerRequestPanel } from './focus/PrayerRequestPanel';
import type { PrayOrb } from './focus/focusOrbUtils';
import { AddPrayerRequestForm } from './focus/AddPrayerRequestForm';

type PrayMode = null | 'choose' | 'pick-request' | 'type' | 'draw';

interface Props {
    characterId: string;
    selectedCharacter?: any;
    setUserCharacters?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter?: (c: any) => Promise<any> | void;
    onPrayerLevelUp?: (bonusXp: number) => void;
    onPrayerSaved?: () => void;
    onDrawingSaved?: (record: DrawingRecord) => void;
    onClose: () => void;
}

const FocusOverlay: React.FC<Props> = ({
    characterId,
    selectedCharacter,
    setUserCharacters,
    saveCharacter,
    onPrayerLevelUp,
    onPrayerSaved,
    onDrawingSaved,
    onClose,
}) => {
    const uid = auth.currentUser?.uid;

    const [videoUrl, setVideoUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [prayMode, setPrayMode] = useState<PrayMode>(null);
    const [prayText, setPrayText] = useState('');
    const [saving, setSaving] = useState(false);
    const [orbPopup, setOrbPopup] = useState<PrayOrb | null>(null);
    const [showPanel, setShowPanel] = useState(true);
    const [pendingPrayType, setPendingPrayType] = useState<'type' | 'draw' | null>(null);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [prayRequests, setPrayRequests] = useState<PrayerRequest[]>([]);
    const [pickSearch, setPickSearch] = useState('');
    const [panelRefreshKey, setPanelRefreshKey] = useState(0);
    const [prayReqPopup, setPrayReqPopup] = useState<{
        text: string; from: number; to: number; fill: number;
        fromLevel: number; newLevel: number; overflow: number;
        phase: 'initial' | 'overflow';
    } | null>(null);
    const prayReqTimers = useRef<number[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const PRAY_LEVEL_COLORS = ['#b5d3f8', '#4ade80', '#fb923c', '#a78bfa', '#f472b6', '#f8f406'];
    const prayLevelColor = (lvl: number) => PRAY_LEVEL_COLORS[(lvl - 1) % PRAY_LEVEL_COLORS.length];

    // Apply a XP gain with overflow levelling. Returns the new { progress, level }.
    const applyGain = (progress: number, level: number, gain: number) => {
        let p = progress + gain;
        let l = level;
        while (p >= 100) { p -= 100; l++; }
        return { progress: p, level: l };
    };

    const triggerPrayReqPopup = (req: PrayerRequest, rawGain: number) => {
        prayReqTimers.current.forEach(clearTimeout);
        prayReqTimers.current = [];
        const from = req.progress;
        const fromLevel = req.level;
        // Compute resulting level + overflow
        let overflow = req.progress + rawGain;
        let newLevel = fromLevel;
        while (overflow >= 100) { overflow -= 100; newLevel++; }
        const leveledUp = newLevel > fromLevel;
        const to = leveledUp ? 100 : overflow;
        setPrayReqPopup({ text: req.text, from, to, fill: from, fromLevel, newLevel, overflow, phase: 'initial' });
        prayReqTimers.current.push(window.setTimeout(() =>
            setPrayReqPopup(p => p ? { ...p, fill: to } : null), 60));
        if (leveledUp) {
            // After bar fills to 100, switch to next-level view
            prayReqTimers.current.push(window.setTimeout(() =>
                setPrayReqPopup(p => p ? { ...p, phase: 'overflow', fill: 0 } : null), 900));
            // Give the browser two frames to paint the empty bar before animating in
            prayReqTimers.current.push(window.setTimeout(() =>
                setPrayReqPopup(p => p ? { ...p, fill: overflow } : null), 1100));
        }
        prayReqTimers.current.push(window.setTimeout(() =>
            setPrayReqPopup(null), 4500));
    };

    const { prayerOrbs, orbGroups, collapsing, spawnOrb, groupOrbs, toggleGroupExpanded } = useFocusOrbs(uid, characterId);
    const { ppLevelUp, xpNotif, awardPrayerXP } = usePrayerAward({
        selectedCharacter,
        setUserCharacters,
        saveCharacter,
        onPrayerLevelUp,
    });

    // Load backdrop video for current prayer level
    useEffect(() => {
        const ppLvl = (selectedCharacter?.prayerLevel as number | undefined) ?? 1;
        setLoading(true);
        setVideoUrl('');
        fetchAnimUrl(focusAnimPath(ppLvl))
            .then(url => { if (url) setVideoUrl(url); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [(selectedCharacter?.prayerLevel as number | undefined) ?? 1]);

    // Load prayer requests when the pick-request step opens
    useEffect(() => {
        if (prayMode === 'pick-request' && uid) {
            loadPrayerRequests(uid, characterId).then(setPrayRequests).catch(console.warn);
            setPickSearch('');
        }
    }, [prayMode, uid, characterId]);

    // Escape key: close panel or dismiss pray mode
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (prayMode === 'pick-request') { setPrayMode('choose'); }
                else if (prayMode) { setPrayMode(null); setPrayText(''); setSelectedRequestId(null); setPendingPrayType(null); }
                else onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, prayMode]);

    useEffect(() => {
        if (prayMode === 'type') textareaRef.current?.focus();
    }, [prayMode]);

    const savePrayer = async () => {
        if (!uid || !prayText.trim()) return;
        const savedText = prayText.trim();
        setSaving(true);
        try {
            await addItemToCharacter(uid, characterId, 'prayers', {
                text: prayText.trim(),
                color: '#bde0fe',
                createdAt: Date.now(),
            });
            // Award progress to the selected prayer request
            if (selectedRequestId) {
                const wordCount = savedText.trim().split(/\s+/).filter(Boolean).length;
                const gain = Math.round((wordCount / 58) * 100);
                if (gain > 0) {
                    const req = prayRequests.find(r => r.id === selectedRequestId);
                    const updated = prayRequests.map(r =>
                        r.id === selectedRequestId
                            ? { ...r, ...applyGain(r.progress, r.level, gain) }
                            : r
                    );
                    await savePrayerRequests(uid, characterId, updated);
                    if (req) triggerPrayReqPopup(req, gain);
                    setPanelRefreshKey(k => k + 1);
                }
            }
            onPrayerSaved?.();
            await awardPrayerXP();
        } finally {
            setSaving(false);
            setPrayText('');
            setPrayMode(null);
            setSelectedRequestId(null);
            setPendingPrayType(null);
            spawnOrb({ text: savedText });
        }
    };

    const handleDrawingSaved = async (record: DrawingRecord, strokeCount: number) => {
        onDrawingSaved?.(record);
        setSelectedRequestId(null);
        setPendingPrayType(null);
        setPrayMode(null);

        // ≤2 strokes = accidental tap; skip XP, orb, and request progress
        if (strokeCount <= 2) return;

        // >2 strokes = full bar on selected request
        if (selectedRequestId && uid) {
            const req = prayRequests.find(r => r.id === selectedRequestId);
            const updated = prayRequests.map(r =>
                r.id === selectedRequestId
                    ? { ...r, ...applyGain(r.progress, r.level, 100) }
                    : r
            );
            await savePrayerRequests(uid, characterId, updated).catch(console.warn);
            if (req) triggerPrayReqPopup(req, 100);
            setPanelRefreshKey(k => k + 1);
        }
        await awardPrayerXP();
        spawnOrb({ imageUrl: record.dataUrl });
    };

    const startPrayForRequest = async (reqId: string) => {
        if (!uid) return;
        const loaded = await loadPrayerRequests(uid, characterId).catch(() => [] as PrayerRequest[]);
        setPrayRequests(loaded);
        setSelectedRequestId(reqId);
        setPendingPrayType('type');
        setShowPanel(false);
        setPrayMode('type');
    };

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
                {loading && <p className="text-white/30 text-sm">Loading…</p>}

                <FocusOrbLayer
                    prayerOrbs={prayerOrbs}
                    orbGroups={orbGroups}
                    onToggleGroup={toggleGroupExpanded}
                    collapsing={collapsing}
                    orbPopup={orbPopup}
                    setOrbPopup={setOrbPopup}
                />

                {/* Prayer-request progress popup */}
                {prayReqPopup && (() => {
                    const lvl = prayReqPopup.phase === 'overflow' ? prayReqPopup.newLevel : prayReqPopup.fromLevel;
                    const clr = prayLevelColor(lvl);
                    const pct = prayReqPopup.phase === 'overflow' ? prayReqPopup.overflow : prayReqPopup.to;
                    return (
                        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                            <div className="bg-black/80 border border-violet-500/40 rounded-xl shadow-lg px-4 py-3 w-60 backdrop-blur-md">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[10px] text-violet-300/60 font-semibold uppercase tracking-widest">🙏 Prayer Request</div>
                                    {prayReqPopup.newLevel > prayReqPopup.fromLevel && prayReqPopup.phase === 'overflow' && (
                                        <div className="text-[10px] font-bold text-yellow-300 animate-pulse">LEVEL UP ✨</div>
                                    )}
                                </div>
                                <div className="text-white/80 text-xs leading-snug mb-2 line-clamp-2">{prayReqPopup.text}</div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                        style={{ background: clr + '30', color: clr }}
                                    >
                                        Lv {lvl}
                                    </span>
                                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full ease-out"
                                            style={{
                                                width: `${prayReqPopup.fill}%`,
                                                background: clr,
                                                transition: prayReqPopup.phase === 'overflow'
                                                    ? 'width 1200ms ease-out'
                                                    : 'width 700ms ease-out',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-semibold flex-shrink-0 w-8 text-right" style={{ color: clr }}>
                                        {Math.round(pct)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {videoUrl && (
                    <video
                        src={videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-200 text-xl leading-none transition-colors"
                >
                    ✕
                </button>

                {/* Toggle prayer panel */}
                <button
                    onClick={() => setShowPanel(v => !v)}
                    aria-label={showPanel ? 'Hide prayer panel' : 'Show prayer panel'}
                    title={showPanel ? 'Hide prayer panel' : 'Show prayer panel'}
                    className="absolute top-4 right-12 z-10 w-7 h-7 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-black/50 hover:text-green-500 text-xs transition-colors"
                >
                    🙏　Requests
                </button>

                {/* Group loose orbs into a single glowing cluster */}
                {prayerOrbs.length >= 2 && (
                    <button
                        onClick={groupOrbs}
                        title="Group prayer orbs"
                        className="absolute top-14 right-4 z-10 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-green-300/80 hover:text-green-300 text-[11px] font-medium transition-colors"
                    >
                        🌿 Group ({prayerOrbs.length})
                    </button>
                )}

                <FocusPrayerBar
                    selectedCharacter={selectedCharacter}
                    ppLevelUp={ppLevelUp}
                    xpNotif={xpNotif}
                />

                {/* Type prayer panel */}
                {prayMode === 'type' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
                        <textarea
                            ref={textareaRef}
                            value={prayText}
                            onChange={e => setPrayText(e.target.value)}
                            placeholder="Write your prayer…"
                            rows={8}
                            className="w-full max-w-lg bg-black/40 text-white placeholder-white/30 border border-white/10 rounded-xl px-5 py-4 text-lg resize-none focus:outline-none focus:border-white/30 backdrop-blur"
                            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) savePrayer(); }}
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={savePrayer}
                                disabled={saving || !prayText.trim()}
                                className="px-5 py-2 bg-blue-600/80 hover:bg-blue-500/90 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-40 backdrop-blur"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                                onClick={() => { setPrayMode(null); setPrayText(''); setSelectedRequestId(null); setPendingPrayType(null); }}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition-colors backdrop-blur"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Floating Pray button / chooser */}
                {prayMode !== 'type' && prayMode !== 'draw' && prayMode !== 'pick-request' && (
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
                        {prayMode === 'choose' && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setPendingPrayType('type'); setPrayMode(selectedRequestId ? 'type' : 'pick-request'); }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-violet/80 rounded-xl text-sm backdrop-blur border border-white/10 transition-colors"
                                >
                                    ✏️ Type
                                </button>
                                <button
                                    onClick={() => { setPendingPrayType('draw'); setPrayMode(selectedRequestId ? 'draw' : 'pick-request'); }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-sm backdrop-blur border border-white/10 transition-colors"
                                >
                                    🖌 Draw
                                </button>
                                <button
                                    onClick={() => setPrayMode(null)}
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl text-sm backdrop-blur transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => setPrayMode(m => m === 'choose' ? null : 'choose')}
                            className="px-5 py-2.5 bg-blue-600/70 hover:bg-blue-500/90 text-white rounded-full text-sm font-semibold shadow-lg backdrop-blur transition-colors"
                        >
                            Pray
                        </button>
                    </div>
                )}

                {/* Pick-request step */}
                {prayMode === 'pick-request' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 z-10">
                        <div className="bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 p-5 w-full max-w-sm">
                            <div className="text-white/70 text-sm font-semibold mb-3 text-center">
                                Which prayer request is this for?
                            </div>
                            <input
                                value={pickSearch}
                                onChange={e => setPickSearch(e.target.value)}
                                placeholder="Search requests…"
                                autoFocus
                                className="w-full bg-white/5 text-white/70 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25 transition-colors mb-2"
                            />
                            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                                {prayRequests.length === 0 && (
                                    <div className="text-white/30 text-xs text-center py-3">No prayer requests yet</div>
                                )}
                                {prayRequests.filter(r => {
                                    const q = pickSearch.trim().toLowerCase();
                                    return !q || r.text.toLowerCase().includes(q);
                                }).map(r => {
                                    const LEVEL_COLORS = ['#b5d3f8','#4ade80','#fb923c','#a78bfa','#f472b6','#f8f406'];
                                    const color = LEVEL_COLORS[(r.level - 1) % LEVEL_COLORS.length];
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => { setSelectedRequestId(r.id); setPrayMode(pendingPrayType!); }}
                                            className="text-left text-xs text-white/80 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 transition-colors flex flex-col gap-1.5"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                                    style={{ background: color + '30', color }}
                                                >
                                                    Lv {r.level}
                                                </span>
                                                <span className="truncate">{r.text}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${Math.min(100, r.progress)}%`, background: color }}
                                                />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => { setSelectedRequestId(null); setPrayMode(pendingPrayType!); }}
                                className="mt-3 w-full text-xs text-white/40 hover:text-white/70 py-1.5 rounded-lg transition-colors"
                            >
                                Skip — no specific request
                            </button>
                            <AddPrayerRequestForm onAdd={async (text) => {
                                if (!uid) return;
                                const newReq: PrayerRequest = {
                                    id: crypto.randomUUID(),
                                    text,
                                    level: 1,
                                    progress: 0,
                                    startDate: Date.now(),
                                };
                                const updated = [...prayRequests, newReq];
                                setPrayRequests(updated);
                                await savePrayerRequests(uid, characterId, updated).catch(console.warn);
                            }} />
                            <div className="border-t border-white/10 mt-3" />
                            <button
                                onClick={() => { setPendingPrayType(null); setPrayMode('choose'); }}
                                className="mt-1 w-full text-xs text-white/25 hover:text-white/50 py-1 rounded-lg transition-colors"
                            >
                                ← Back
                            </button>
                        </div>
                    </div>
                )}

                {/* Prayer request carousel — right-side panel */}
                {uid && prayMode !== 'draw' && showPanel && (
                    <PrayerRequestPanel
                        uid={uid}
                        characterId={characterId}
                        onLevelUp={awardPrayerXP}
                        refreshKey={panelRefreshKey}
                        onPrayForRequest={startPrayForRequest}
                    />
                )}
            </div>

            {/* Drawing canvas — renders on top */}
            {prayMode === 'draw' && uid && (
                <DrawingCanvas
                    uid={uid}
                    charId={characterId}
                    onSave={handleDrawingSaved}
                    onClose={() => setPrayMode(null)}
                />
            )}
        </>
    );
};

export default FocusOverlay;


