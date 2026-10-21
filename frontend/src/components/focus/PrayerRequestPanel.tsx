import React, { useEffect, useRef, useState } from 'react';
import {
    loadPrayerRequests,
    savePrayerRequests,
    loadPrayerRequestGroups,
    savePrayerRequestGroups,
    type PrayerRequest,
    type PrayerRequestGroup,
} from '../../services/prayerService';
import { AddPrayerRequestForm } from './AddPrayerRequestForm';

const LEVEL_COLORS = ['#b5d3f8', '#4ade80', '#fb923c', '#a78bfa', '#f472b6', '#f8f406'];
const levelColor = (lvl: number) => LEVEL_COLORS[(lvl - 1) % LEVEL_COLORS.length];

interface Props {
    uid: string;
    characterId: string;
    onLevelUp?: () => void;
    refreshKey?: number;
    onPrayForRequest?: (id: string) => void;
}

export const PrayerRequestPanel: React.FC<Props> = ({ uid, characterId, onLevelUp, refreshKey, onPrayForRequest }) => {
    const [requests, setRequests] = useState<PrayerRequest[]>([]);
    const [groups, setGroups] = useState<PrayerRequestGroup[]>([]);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
    const [newGroupName, setNewGroupName] = useState('');
    const [search, setSearch] = useState('');
    const [flashId, setFlashId] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [isSmall, setIsSmall] = useState(() => window.innerWidth < 1024);
    const listRef = useRef<HTMLDivElement>(null);
    const jumping = useRef(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)');
        const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEffect(() => {
        loadPrayerRequests(uid, characterId).then(setRequests).catch(console.warn);
        loadPrayerRequestGroups(uid, characterId).then(setGroups).catch(console.warn);
    }, [uid, characterId, refreshKey]);

    const searching = search.trim().length > 0;
    const groupIds = new Set(groups.map(g => g.id));
    const isGrouped = (r: PrayerRequest) => !!r.groupId && groupIds.has(r.groupId);

    // Grouped requests live inside their group tile; searching shows everything flat.
    const filtered = requests.filter(r => {
        const q = search.trim().toLowerCase();
        if (!q) return !isGrouped(r);
        if (r.text.toLowerCase().includes(q)) return true;
        return new Date(r.startDate).toLocaleDateString().includes(q);
    });

    // Re-centre to the middle copy whenever the visible list changes (large screens only)
    useEffect(() => {
        if (isSmall) return;
        const el = listRef.current;
        if (!el || filtered.length < 2) return;
        el.scrollTop = el.scrollHeight / 3;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtered.length, search, isSmall]);

    const handleScroll = () => {
        const el = listRef.current;
        if (!el || jumping.current || isSmall || filtered.length < 2) return;
        const third = el.scrollHeight / 3;
        if (el.scrollTop < 24) {
            jumping.current = true;
            el.scrollTop += third;
            jumping.current = false;
        } else if (el.scrollTop + el.clientHeight > el.scrollHeight - 24) {
            jumping.current = true;
            el.scrollTop -= third;
            jumping.current = false;
        }
    };

    const persist = (updated: PrayerRequest[]) => {
        setRequests(updated);
        savePrayerRequests(uid, characterId, updated).catch(console.warn);
    };

    const addRequest = (text: string) => {
        const req: PrayerRequest = {
            id: `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            text,
            startDate: Date.now(),
            progress: 0,
            level: 1,
        };
        persist([req, ...requests]);
    };

    const changeProgress = (id: string, delta: number) => {
        const r = requests.find(x => x.id === id);
        if (!r) return;
        let p = Math.max(0, r.progress + delta);
        let l = r.level;
        let didLevelUp = false;
        while (p >= 100) { p -= 100; l++; didLevelUp = true; }
        if (didLevelUp) {
            setFlashId(id);
            setTimeout(() => setFlashId(null), 1400);
            onLevelUp?.();
        }
        persist(requests.map(x => x.id === id ? { ...x, progress: p, level: l } : x));
    };

    const persistGroups = (updated: PrayerRequestGroup[]) => {
        setGroups(updated);
        savePrayerRequestGroups(uid, characterId, updated).catch(console.warn);
    };

    const addGroup = () => {
        const name = newGroupName.trim();
        if (!name) return;
        persistGroups([...groups, { id: `pg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, name }]);
        setNewGroupName('');
    };

    const deleteGroup = (id: string) => {
        persistGroups(groups.filter(g => g.id !== id));
        persist(requests.map(r => r.groupId === id ? { ...r, groupId: undefined } : r));
    };

    const moveToGroup = (reqId: string, groupId: string) => {
        persist(requests.map(r => r.id === reqId ? { ...r, groupId: groupId || undefined } : r));
    };

    const deleteRequest = (id: string) => {
        persist(requests.filter(r => r.id !== id));
        setPendingDeleteId(null);
    };

    const renderCard = (req: PrayerRequest, key: string) => {
        const color = levelColor(req.level);
        return (
                                    <div
                                        key={key}
                                        onClick={() => {
                                            if (editingId !== req.id) onPrayForRequest?.(req.id);
                                        }}
                                        className={`rounded-xl border border-white/15 bg-white/10 px-2.5 py-2 flex flex-col gap-1 relative${onPrayForRequest && editingId !== req.id ? ' cursor-pointer hover:border-white/30' : ''}`}
                                    >
                                        {/* top row: level badge + date + delete */}
                                        <div className="flex items-center justify-between gap-1 flex-shrink-0">
                                            <span
                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                                                style={{ background: color + '30', color }}
                                            >
                                                Lv {req.level}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] text-white/30 min-w-0">
                                                <span className="truncate">
                                                    {new Date(req.startDate).toLocaleDateString()}
                                                </span>
                                                {pendingDeleteId === req.id ? (
                                                    <>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); deleteRequest(req.id); }}
                                                            className="text-red-400 hover:text-red-300 font-semibold flex-shrink-0 transition-colors"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setPendingDeleteId(null); }}
                                                            className="hover:text-white/60 flex-shrink-0 transition-colors"
                                                        >
                                                            No
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setPendingDeleteId(req.id); }}
                                                        className="hover:text-red-400 transition-colors flex-shrink-0"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* text */}
                                        {editingId === req.id ? (
                                            <div className="flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                                                <div className="text-[10px] text-white/45 font-semibold uppercase tracking-wide truncate">
                                                    Editing: {req.text}
                                                </div>
                                                <textarea
                                                    autoFocus
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    onBlur={() => {
                                                        const trimmed = editText.trim();
                                                        if (trimmed) persist(requests.map(r => r.id === req.id ? { ...r, text: trimmed } : r));
                                                        setEditingId(null);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                                                        if (e.key === 'Escape') { setEditingId(null); }
                                                    }}
                                                    className="w-full bg-white/10 text-white/90 text-xs leading-snug rounded px-1.5 py-1 border border-white/20 outline-none resize-none"
                                                    rows={3}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="text-white/80 text-xs leading-snug cursor-pointer hover:text-white/100 transition-colors"
                                                onClick={e => { e.stopPropagation(); setEditingId(req.id); setEditText(req.text); }}
                                            >
                                                {req.text}
                                            </div>
                                        )}

                                        {groups.length > 0 && editingId !== req.id && (
                                            <select
                                                value={req.groupId && groupIds.has(req.groupId) ? req.groupId : ''}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => moveToGroup(req.id, e.target.value)}
                                                className="bg-white/5 text-white/50 text-[10px] rounded border border-white/10 px-1 py-0.5 outline-none"
                                                aria-label="Move to group"
                                            >
                                                <option value="">No group</option>
                                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                            </select>
                                        )}

                                        {/* progress bar row */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${req.progress}%`, background: color }}
                                                />
                                            </div>
                                        </div>

                                        {/* level-up flash overlay */}
                                        {flashId === req.id && (
                                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 pointer-events-none">
                                                <span className="text-yellow-300 font-bold text-sm animate-bounce">
                                                    ✨ Level Up!
                                                </span>
                                            </div>
                                        )}
                                    </div>
        );
    };

    return (
        <div className="absolute top-0 right-0 h-full w-72 z-10 flex flex-col py-14 pr-3 pl-1 pointer-events-none">
            <div className="flex flex-col h-full bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden pointer-events-auto">

                {/* ── Header ──────────────────────────────────────── */}
                <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">
                            🙏 Prayer Requests
                        </div>
                        <span className="text-[10px] text-white/50 font-semibold px-1.5 py-0.5 rounded-md bg-white/10 border border-white/10">
                            {requests.length}
                        </span>
                    </div>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by keyword or date…"
                        className="w-full bg-white/5 text-white/70 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25 transition-colors"
                    />
                </div>

                {/* ── Request groups (separate from the carousel's scroll area) ── */}
                    {!searching && (
                        <div className="flex flex-col gap-2 px-2 pt-2 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '45%' }}>
                            {groups.map(g => {
                                const members = requests.filter(r => r.groupId === g.id);
                                const open = !!openGroups[g.id];
                                return (
                                    <div key={g.id} className="rounded-xl border border-white/20 bg-white/5">
                                        <div className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer" onClick={() => setOpenGroups(prev => ({ ...prev, [g.id]: !open }))}>
                                            <span className="text-white/50 text-[10px]">{open ? '▾' : '▸'}</span>
                                            <span className="flex-1 min-w-0 truncate text-white/85 text-xs font-semibold">📁 {g.name}</span>
                                            <span className="text-[10px] text-white/50 px-1.5 rounded-md bg-white/10">{members.length}</span>
                                            <button
                                                onClick={e => { e.stopPropagation(); if (window.confirm(`Delete group "${g.name}"? Its requests will be kept ungrouped.`)) deleteGroup(g.id); }}
                                                className="text-[10px] text-white/30 hover:text-red-400 transition-colors"
                                                aria-label={`Delete group ${g.name}`}
                                            >✕</button>
                                        </div>
                                        {open && (
                                            <div className="flex flex-col gap-2 px-2 pb-2">
                                                {members.length === 0
                                                    ? <div className="text-white/25 text-[11px] text-center py-2">Empty — use "Move to group" on a request</div>
                                                    : members.map(r => renderCard(r, `g-${r.id}`))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="flex gap-1.5">
                                <input
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') addGroup(); }}
                                    placeholder="New group (e.g. Government)…"
                                    className="flex-1 min-w-0 bg-white/5 text-white/70 text-[11px] px-2 py-1 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25"
                                />
                                <button onClick={addGroup} disabled={!newGroupName.trim()} className="text-white/50 hover:text-white px-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs">📁＋</button>
                            </div>
                        </div>
                    )}
                {/* ── List (carousel on large, plain scroll on small) ── */}
                <div
                    ref={isSmall ? undefined : listRef}
                    onScroll={isSmall ? undefined : handleScroll}
                    className="flex-1 overflow-y-auto px-2 py-2"
                    style={{ minHeight: 0 }}
                >
                    {filtered.length === 0 ? (
                        <div className="text-white/25 text-xs text-center mt-8 px-4 leading-relaxed">
                            {searching ? 'No matching requests' : requests.length > 0 ? 'All requests are in groups' : 'Add a prayer request below'}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {(isSmall || filtered.length < 2 ? filtered : [...filtered, ...filtered, ...filtered]).map((req, i) =>
                                renderCard(req, isSmall || filtered.length < 2 ? req.id : `${i}-${req.id}`)
                            )}
                        </div>
                    )}
                </div>

                <AddPrayerRequestForm onAdd={addRequest} />

            </div>
        </div>
    );
};
