import React, { useEffect, useState } from "react";
import { getTrainingSessions, getPuzzleSessions } from "../services/trainingDataService";
import type { TrainingSession, TrainingQuestionEntry, PuzzleSession } from "../types/trainingData";
import { SUBTOPIC_LABELS } from "../utils/trainingUtils";

interface Props {
    uid: string;
    characterId: string;
    characterName: string;
    onClose: () => void;
}

function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtPct(pct: number): string {
    return `${pct}%`;
}

function fmtTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtGoalDiff(elapsed: number, goal: number | null): string {
    if (!goal) return '—';
    const diff = Math.round(((elapsed - goal) / goal) * 100);
    return diff === 0 ? '0%' : diff > 0 ? `+${diff}%` : `${diff}%`;
}

function subtopicLabel(s: string): string {
    return (SUBTOPIC_LABELS as Record<string, string>)[s] ?? s;
}

// Compute average pct grouped by a key
function avgByKey<T extends { pct: number }>(items: T[], keyFn: (x: T) => string): { key: string; avg: number; count: number }[] {
    const groups: Record<string, number[]> = {};
    for (const item of items) {
        const k = keyFn(item);
        if (!groups[k]) groups[k] = [];
        groups[k].push(item.pct);
    }
    return Object.entries(groups).map(([key, pcts]) => ({
        key,
        avg: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
        count: pcts.length,
    })).sort((a, b) => a.key.localeCompare(b.key));
}

const TrainingStatsModal: React.FC<Props> = ({ uid, characterId, characterName, onClose }) => {
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [puzzleSessions, setPuzzleSessions] = useState<PuzzleSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
    const [tab, setTab] = useState<"sessions" | "averages">("sessions");
    const [mode, setMode] = useState<"training" | "puzzle">("training");
    const isJqz = uid.startsWith('Jqz');
    const pctOverridesKey = `trainingPctOverrides:${uid}:${characterId}`;
    const [pctOverrides, setPctOverridesRaw] = useState<Record<string, number>>(() => {
        try {
            const stored = localStorage.getItem(`trainingPctOverrides:${uid}:${characterId}`);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });
    const setPctOverrides = (updater: ((prev: Record<string, number>) => Record<string, number>)) => {
        setPctOverridesRaw(prev => {
            const next = updater(prev);
            try { localStorage.setItem(pctOverridesKey, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };
    const [editingPctId, setEditingPctId] = useState<string | null>(null);
    const [editingPctValue, setEditingPctValue] = useState<string>("");

    useEffect(() => {
        setLoading(true);
        Promise.all([
            getTrainingSessions(uid, characterId),
            getPuzzleSessions(uid, characterId),
        ]).then(([training, puzzle]) => {
            setSessions(training);
            setPuzzleSessions(puzzle);
            setLoading(false);
        });
    }, [uid, characterId]);

    const sessionsForAvg = sessions.map(s => ({
        ...s,
        pct: s.id !== undefined && pctOverrides[s.id] !== undefined ? pctOverrides[s.id] : s.pct,
    }));

    const bySubtopic = avgByKey(sessionsForAvg, s => s.subtopic);
    const byLevel = avgByKey(sessionsForAvg, s => String(s.level));

    // Puzzle averages: avg elapsed seconds by level
    const puzzleAvgByLevel: { key: string; avgElapsed: number; count: number }[] = (() => {
        const groups: Record<string, number[]> = {};
        for (const ps of puzzleSessions) {
            const k = String(ps.level);
            if (!groups[k]) groups[k] = [];
            groups[k].push(ps.elapsedSeconds);
        }
        return Object.entries(groups)
            .map(([key, vals]) => ({
                key,
                avgElapsed: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
                count: vals.length,
            }))
            .sort((a, b) => a.key.localeCompare(b.key));
    })();

    return (
        <div
            className="fixed inset-0 z-[80] bg-black bg-opacity-60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-gray-950 border border-yellow-400 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-yellow-700">
                    {selectedSession ? (
                        <>
                            <div>
                                <h2 className="text-yellow-300 font-bold text-lg">Session Detail</h2>
                                <p className="text-gray-400 text-sm">
                                    {fmtDate(selectedSession.date)} · {subtopicLabel(selectedSession.subtopic)} Lv {selectedSession.level} · {selectedSession.correct}/{selectedSession.total} ({fmtPct(selectedSession.pct)})
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSession(null)}
                                className="text-gray-400 hover:text-white text-xl font-bold leading-none"
                                title="Back"
                            >
                                ← Back
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <h2 className="text-yellow-300 font-bold text-lg">Training Stats</h2>
                                <p className="text-gray-400 text-sm">{characterName}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-white text-xl font-bold leading-none"
                            >
                                ✕
                            </button>
                        </>
                    )}
                </div>

                {/* Session detail view */}
                {selectedSession && (
                    <div className="flex-1 overflow-y-auto px-5 py-3">
                        {selectedSession.entries.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center mt-8">No per-question data recorded.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                        <th className="text-left py-2 pr-4">#</th>
                                        <th className="text-left py-2 pr-4">Question</th>
                                        <th className="text-left py-2 pr-4">Your Answer</th>
                                        <th className="text-left py-2 pr-4">Correct Answer</th>
                                        <th className="text-center py-2">Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSession.entries.map((e: TrainingQuestionEntry, i: number) => (
                                        <tr
                                            key={i}
                                            className={`border-b border-gray-800 ${e.correct ? "text-green-300" : "text-red-300"}`}
                                        >
                                            <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                                            <td className="py-2 pr-4">{e.question}</td>
                                            <td className="py-2 pr-4">{e.userAnswer}</td>
                                            <td className="py-2 pr-4 text-gray-300">{e.correctAnswer}</td>
                                            <td className="py-2 text-center">{e.correct ? "✓" : "✗"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Tabs + Body: shown when no session is selected */}
                {!selectedSession && (<>
                    {/* Mode toggle */}
                    <div className="flex border-b border-gray-800">
                        <button
                            onClick={() => setMode("training")}
                            className={`flex-1 py-2 text-sm font-semibold transition ${mode === "training" ? "text-yellow-300 border-b-2 border-yellow-400" : "text-gray-400 hover:text-white"}`}
                        >
                            Training
                        </button>
                        <button
                            onClick={() => setMode("puzzle")}
                            className={`flex-1 py-2 text-sm font-semibold transition ${mode === "puzzle" ? "text-fuchsia-300 border-b-2 border-fuchsia-400" : "text-gray-400 hover:text-white"}`}
                        >
                            Puzzle
                        </button>
                    </div>

                    {/* Tabs (training only) */}
                    {mode === "training" && (
                        <div className="flex border-b border-gray-800">
                            <button
                                onClick={() => setTab("sessions")}
                                className={`flex-1 py-2 text-sm font-semibold transition ${tab === "sessions" ? "text-yellow-300 border-b-2 border-yellow-400" : "text-gray-400 hover:text-white"}`}
                            >
                                Sessions
                            </button>
                            <button
                                onClick={() => setTab("averages")}
                                className={`flex-1 py-2 text-sm font-semibold transition ${tab === "averages" ? "text-yellow-300 border-b-2 border-yellow-400" : "text-gray-400 hover:text-white"}`}
                            >
                                Averages
                            </button>
                        </div>
                    )}

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-3">
                        {loading ? (
                            <p className="text-gray-400 text-sm text-center mt-8">Loading…</p>
                        ) : mode === "puzzle" ? (
                            /* ── Puzzle body ── */
                            puzzleSessions.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center mt-8">No puzzle sessions recorded yet.</p>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    {/* Puzzle sessions table */}
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                                <th className="text-left py-2 pr-3">Date</th>
                                                <th className="text-left py-2 pr-3">Type</th>
                                                <th className="text-center py-2 pr-3">Lv</th>
                                                <th className="text-center py-2 pr-3">Time</th>
                                                <th className="text-center py-2 pr-3">Goal</th>
                                                <th className="text-center py-2 pr-3">Diff</th>
                                                <th className="text-center py-2 pr-3">XP</th>
                                                <th className="text-center py-2">✓</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {puzzleSessions.map(ps => {
                                                const diff = ps.goalSeconds
                                                    ? Math.round(((ps.elapsedSeconds - ps.goalSeconds) / ps.goalSeconds) * 100)
                                                    : null;
                                                const diffColor = diff === null ? 'text-gray-500'
                                                    : diff <= 0 ? 'text-cyan-400'
                                                        : diff <= 50 ? 'text-yellow-300'
                                                            : 'text-red-400';
                                                return (
                                                    <tr key={ps.id} className="border-b border-gray-800">
                                                        <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{fmtDate(ps.date)}</td>
                                                        <td className="py-2 pr-3 text-gray-300">{ps.label}</td>
                                                        <td className="py-2 pr-3 text-center text-fuchsia-300">{ps.level}</td>
                                                        <td className="py-2 pr-3 text-center font-mono text-cyan-300">{fmtTime(ps.elapsedSeconds)}</td>
                                                        <td className="py-2 pr-3 text-center text-gray-400 font-mono">{ps.goalSeconds ? fmtTime(ps.goalSeconds) : '—'}</td>
                                                        <td className={`py-2 pr-3 text-center font-bold ${diffColor}`}>{fmtGoalDiff(ps.elapsedSeconds, ps.goalSeconds)}</td>
                                                        <td className="py-2 pr-3 text-center text-yellow-300">{ps.xpAwarded > 0 ? `+${ps.xpAwarded}` : '0'}</td>
                                                        <td className="py-2 text-center">{ps.solved ? <span className="text-cyan-400">✓</span> : <span className="text-gray-600">✗</span>}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {/* Puzzle averages by level */}
                                    <div>
                                        <h3 className="text-fuchsia-300 font-semibold text-sm mb-2 uppercase tracking-wide">Avg Time by Level</h3>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                                    <th className="text-left py-2 pr-4">Level</th>
                                                    <th className="text-center py-2 pr-4">Sessions</th>
                                                    <th className="text-center py-2">Avg Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {puzzleAvgByLevel.map(row => (
                                                    <tr key={row.key} className="border-b border-gray-800">
                                                        <td className="py-2 pr-4 text-white">Level {row.key}</td>
                                                        <td className="py-2 pr-4 text-center text-gray-300">{row.count}</td>
                                                        <td className="py-2 text-center font-mono font-bold text-cyan-300">{fmtTime(row.avgElapsed)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        ) : sessions.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center mt-8">No training sessions recorded yet.</p>
                        ) : tab === "sessions" ? (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                        <th className="text-left py-2 pr-3">Date</th>
                                        <th className="text-left py-2 pr-3">Topic</th>
                                        <th className="text-left py-2 pr-3">Subtopic</th>
                                        <th className="text-center py-2 pr-3">Lv</th>
                                        <th className="text-center py-2 pr-3">Score</th>
                                        <th className="text-center py-2">%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sessions.map(s => (
                                        <tr
                                            key={s.id}
                                            onClick={() => setSelectedSession(s)}
                                            className="border-b border-gray-800 hover:bg-gray-900 cursor-pointer transition group"
                                        >
                                            <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">{fmtDate(s.date)}</td>
                                            <td className="py-2 pr-3 text-gray-300">{s.topic}</td>
                                            <td className="py-2 pr-3 text-white">{subtopicLabel(s.subtopic)}</td>
                                            <td className="py-2 pr-3 text-center text-purple-300">{s.level}</td>
                                            <td className="py-2 pr-3 text-center text-white">{s.correct}/{s.total}</td>
                                            <td
                                                className="py-2 text-center"
                                                onClick={isJqz ? e => {
                                                    e.stopPropagation();
                                                    if (!s.id) return;
                                                    setEditingPctId(s.id);
                                                    setEditingPctValue(String(pctOverrides[s.id] ?? s.pct));
                                                } : undefined}
                                            >
                                                {isJqz && s.id && editingPctId === s.id ? (
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={100}
                                                        value={editingPctValue}
                                                        autoFocus
                                                        onChange={e => setEditingPctValue(e.target.value)}
                                                        onBlur={() => {
                                                            const sid = s.id!;
                                                            const val = Math.min(100, Math.max(0, parseInt(editingPctValue, 10)));
                                                            if (!isNaN(val)) setPctOverrides(prev => ({ ...prev, [sid]: val }));
                                                            setEditingPctId(null);
                                                        }}
                                                        onKeyDown={e => {
                                                            const sid = s.id!;
                                                            if (e.key === 'Enter') {
                                                                const val = Math.min(100, Math.max(0, parseInt(editingPctValue, 10)));
                                                                if (!isNaN(val)) setPctOverrides(prev => ({ ...prev, [sid]: val }));
                                                                setEditingPctId(null);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingPctId(null);
                                                            }
                                                        }}
                                                        onClick={e => e.stopPropagation()}
                                                        className="w-14 bg-gray-800 text-cyan-300 font-bold text-center rounded border border-cyan-500 outline-none"
                                                    />
                                                ) : (
                                                    <span className={`font-bold ${isJqz ? 'cursor-pointer' : ''} ${
                                                        s.id !== undefined && pctOverrides[s.id] !== undefined
                                                            ? 'text-cyan-300'
                                                            : s.pct >= 80 ? 'text-green-400' : s.pct >= 50 ? 'text-yellow-300' : 'text-red-400'
                                                    }`}>
                                                        {fmtPct(s.id !== undefined ? (pctOverrides[s.id] ?? s.pct) : s.pct)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col gap-6">
                                {/* Averages by subtopic */}
                                <div>
                                    <h3 className="text-yellow-300 font-semibold text-sm mb-2 uppercase tracking-wide">By Subtopic</h3>
                                    {bySubtopic.length === 0 ? (
                                        <p className="text-gray-500 text-sm">No data.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                                    <th className="text-left py-2 pr-4">Subtopic</th>
                                                    <th className="text-center py-2 pr-4">Sessions</th>
                                                    <th className="text-center py-2">Avg %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bySubtopic.map(row => (
                                                    <tr key={row.key} className="border-b border-gray-800">
                                                        <td className="py-2 pr-4 text-white">{subtopicLabel(row.key)}</td>
                                                        <td className="py-2 pr-4 text-center text-gray-300">{row.count}</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`font-bold ${row.avg >= 80 ? "text-green-400" : row.avg >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                                                                {fmtPct(row.avg)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>

                                {/* Averages by level */}
                                <div>
                                    <h3 className="text-yellow-300 font-semibold text-sm mb-2 uppercase tracking-wide">By Level</h3>
                                    {byLevel.length === 0 ? (
                                        <p className="text-gray-500 text-sm">No data.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                                                    <th className="text-left py-2 pr-4">Level</th>
                                                    <th className="text-center py-2 pr-4">Sessions</th>
                                                    <th className="text-center py-2">Avg %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {byLevel.map(row => (
                                                    <tr key={row.key} className="border-b border-gray-800">
                                                        <td className="py-2 pr-4 text-white">Level {row.key}</td>
                                                        <td className="py-2 pr-4 text-center text-gray-300">{row.count}</td>
                                                        <td className="py-2 text-center">
                                                            <span className={`font-bold ${row.avg >= 80 ? "text-green-400" : row.avg >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                                                                {fmtPct(row.avg)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>)}
            </div>
        </div>
    );
};

export default TrainingStatsModal;
