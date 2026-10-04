import React, { useEffect, useRef, useState } from "react";
import { GoalTimer, getGoalTimers, addGoalTimer, updateGoalTimer, deleteGoalTimer } from "../services/goalTimerService";

interface CharacterOption {
    id: string;
    name: string;
}

interface Props {
    uid?: string | null;
    onClose: () => void;
    characterGroups: string[];
    characters: CharacterOption[];
    onAwardGroupXp: (group: string, points: number) => void;
    onAwardCharacterXp: (characterId: string, points: number) => void;
}

const GOAL_COLORS = [
    { label: "Amber", value: "#f59e0b" },
    { label: "Emerald", value: "#10b981" },
    { label: "Sky", value: "#0ea5e9" },
    { label: "Rose", value: "#f43f5e" },
    { label: "Violet", value: "#8b5cf6" },
    { label: "Lime", value: "#84cc16" },
];

const GOAL_LEVELS = [
    { label: "Simple", value: "simple", rate: 5 },
    { label: "Complex", value: "complex", rate: 10 },
    { label: "Challenging", value: "challenging", rate: 20 },
] as const;

type GoalLevel = typeof GOAL_LEVELS[number]["value"];

const formatTime = (seconds: number | null) => {
    if (seconds === null || !Number.isFinite(seconds)) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
};

const GoalMode: React.FC<Props> = ({ uid, onClose, characterGroups, characters, onAwardGroupXp, onAwardCharacterXp }) => {
    const [title, setTitle] = useState("");
    const [notes, setNotes] = useState("");
    const [color, setColor] = useState(GOAL_COLORS[0].value);
    const [goalLevel, setGoalLevel] = useState<GoalLevel>("simple");
    const [minutesInput, setMinutesInput] = useState("25");
    const [totalSeconds, setTotalSeconds] = useState<number | null>(null);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [running, setRunning] = useState(false);
    const [promptPhase, setPromptPhase] = useState<'idle' | 'ask' | 'pause-check' | 'choose-target' | 'awarded' | 'declined'>('idle');
    const [awardMode, setAwardMode] = useState<'group' | 'individual'>('group');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedCharacterId, setSelectedCharacterId] = useState('');
    const [finishedEarly, setFinishedEarly] = useState(false);
    const endsAtRef = useRef<number | null>(null);
    const [savedTimers, setSavedTimers] = useState<GoalTimer[]>([]);
    const [showSavedTimers, setShowSavedTimers] = useState(false);
    const [timerEditor, setTimerEditor] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(null);
    const [editorDraft, setEditorDraft] = useState({ title: '', minutes: '25', level: 'simple' as GoalLevel, color: GOAL_COLORS[0].value, notes: '' });
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [savingTimer, setSavingTimer] = useState(false);
    const deleteConfirmTimeout = useRef<number | null>(null);

    // Load the user's saved goal timer presets once on mount.
    useEffect(() => {
        if (!uid) return;
        let cancelled = false;
        getGoalTimers(uid)
            .then((timers) => { if (!cancelled) setSavedTimers(timers); })
            .catch((err) => console.error("Failed to load goal timers", err));
        return () => { cancelled = true; };
    }, [uid]);

    useEffect(() => {
        if (!running || endsAtRef.current === null) return;
        const tick = () => {
            const remaining = Math.max(0, Math.ceil((endsAtRef.current! - Date.now()) / 1000));
            setSecondsRemaining(remaining);
            if (remaining === 0) setRunning(false);
        };
        tick();
        const intervalId = window.setInterval(tick, 250);
        return () => window.clearInterval(intervalId);
    }, [running]);

    const startTimer = () => {
        const minutes = Number(minutesInput);
        if (!Number.isFinite(minutes) || minutes <= 0) return;
        const duration = Math.ceil(minutes * 60);
        endsAtRef.current = Date.now() + duration * 1000;
        setTotalSeconds(duration);
        setSecondsRemaining(duration);
        setRunning(true);
        setPromptPhase('idle');
        setAwardMode('group');
        setSelectedGroup('');
        setSelectedCharacterId('');
        setFinishedEarly(false);
    };

    // Freeze the remaining time by dropping the end target; resume recomputes it.
    const pauseTimer = () => {
        endsAtRef.current = null;
        setRunning(false);
        if (secondsRemaining !== null && secondsRemaining > 0) setPromptPhase('pause-check');
    };

    const resumeTimer = () => {
        if (secondsRemaining === null || secondsRemaining <= 0) return;
        endsAtRef.current = Date.now() + secondsRemaining * 1000;
        setRunning(true);
    };

    const resetTimer = () => {
        setRunning(false);
        setTotalSeconds(null);
        setSecondsRemaining(null);
        endsAtRef.current = null;
        setPromptPhase('idle');
        setAwardMode('group');
        setSelectedGroup('');
        setSelectedCharacterId('');
        setFinishedEarly(false);
    };

    // Load a saved preset into the editor fields. Only allowed while fully idle
    // (no timer running or paused) so an in-progress goal can't be clobbered.
    const applySavedTimer = (timer: GoalTimer) => {
        if (running || secondsRemaining !== null) return;
        setTitle(timer.title);
        setNotes(timer.notes);
        setColor(timer.color);
        setGoalLevel(timer.level);
        setMinutesInput(String(timer.minutes));
    };

    const openCreateEditor = () => {
        setEditorDraft({
            title: title.trim(),
            minutes: minutesInput,
            level: goalLevel,
            color,
            notes: notes.trim(),
        });
        setTimerEditor({ mode: 'create' });
    };

    const openEditEditor = (timer: GoalTimer) => {
        setEditorDraft({
            title: timer.title,
            minutes: String(timer.minutes),
            level: timer.level,
            color: timer.color,
            notes: timer.notes,
        });
        setTimerEditor({ mode: 'edit', id: timer.id });
    };

    const saveTimerEditor = async () => {
        if (!uid || !timerEditor) return;
        const minutes = Number(editorDraft.minutes);
        if (!editorDraft.title.trim() || !Number.isFinite(minutes) || minutes <= 0) return;
        const payload = {
            title: editorDraft.title.trim(),
            notes: editorDraft.notes,
            color: editorDraft.color,
            level: editorDraft.level,
            minutes,
        };
        setSavingTimer(true);
        try {
            if (timerEditor.mode === 'create') {
                const created = await addGoalTimer(uid, payload);
                setSavedTimers((prev) => [...prev, created]);
            } else {
                await updateGoalTimer(uid, timerEditor.id, payload);
                setSavedTimers((prev) => prev.map((t) => (t.id === timerEditor.id ? { ...t, ...payload } : t)));
            }
            setTimerEditor(null);
        } catch (err) {
            console.error("Failed to save goal timer", err);
        } finally {
            setSavingTimer(false);
        }
    };

    // Two-tap delete confirm: first tap arms it, auto-disarming after a few seconds.
    const requestDeleteTimer = (timerId: string) => {
        if (deleteConfirmTimeout.current) window.clearTimeout(deleteConfirmTimeout.current);
        setConfirmDeleteId(timerId);
        deleteConfirmTimeout.current = window.setTimeout(() => setConfirmDeleteId(null), 3000);
    };

    const removeSavedTimer = async (timerId: string) => {
        if (!uid) return;
        try {
            await deleteGoalTimer(uid, timerId);
            setSavedTimers((prev) => prev.filter((t) => t.id !== timerId));
        } catch (err) {
            console.error("Failed to delete goal timer", err);
        } finally {
            setConfirmDeleteId(null);
        }
    };

    const previewSeconds = Number(minutesInput) > 0 ? Math.round(Number(minutesInput) * 60) : null;
    const displaySeconds = secondsRemaining ?? previewSeconds;
    const progressPct = totalSeconds && secondsRemaining !== null
        ? Math.max(0, Math.min(100, Math.round((secondsRemaining / totalSeconds) * 100)))
        : 100;
    const isDone = totalSeconds !== null && secondsRemaining === 0;
    const elapsedSeconds = totalSeconds !== null ? totalSeconds - (secondsRemaining ?? totalSeconds) : 0;
    const minutesElapsed = elapsedSeconds / 60;
    const pointsPerMinute = GOAL_LEVELS.find((l) => l.value === goalLevel)?.rate ?? 5;
    const pointsEarned = Math.round(minutesElapsed * pointsPerMinute);

    // Surface the "did you reach the goal?" prompt once the countdown hits zero.
    useEffect(() => {
        if (isDone) setPromptPhase(prev => (prev === 'idle' ? 'ask' : prev));
    }, [isDone]);

    return (
        <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center overflow-y-auto p-6">
            <div className="w-full max-w-xl flex items-center justify-between mb-6">
                <button onClick={onClose} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium">
                    ← Back
                </button>
                <h2 className="text-white font-semibold text-lg">Goal</h2>
                <div className="w-[68px]" />
            </div>

            <div className="w-full max-w-xl flex flex-col items-center gap-4">
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Goal title"
                    className="w-full bg-transparent border-b border-gray-600 focus:border-gray-300 outline-none text-white text-xl text-center font-semibold py-2"
                />

                <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-3 rounded-full transition-all duration-300 ease-linear ${isDone ? "animate-pulse" : ""}`}
                        style={{ width: `${progressPct}%`, background: color }}
                    />
                </div>

                <div className="text-6xl sm:text-7xl font-mono font-bold py-4" style={{ color }}>
                    {formatTime(displaySeconds)}
                </div>

                <div className="flex items-center gap-1.5">
                    {GOAL_LEVELS.map((lvl) => (
                        <button
                            key={lvl.value}
                            onClick={() => setGoalLevel(lvl.value)}
                            disabled={secondsRemaining !== null}
                            title={`${lvl.rate} XP per minute`}
                            className={`px-3 py-1 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
                                goalLevel === lvl.value ? "text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                            }`}
                            style={goalLevel === lvl.value ? { background: color } : undefined}
                        >
                            {lvl.label} · {lvl.rate}/min
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={minutesInput}
                        onChange={(e) => setMinutesInput(e.target.value)}
                        disabled={running || secondsRemaining !== null}
                        className="w-16 bg-gray-800 text-white text-center rounded px-2 py-1 outline-none disabled:opacity-50"
                        aria-label="Timer minutes"
                    />
                    <span className="text-gray-400 text-sm">min</span>

                    {!running && secondsRemaining === null && (
                        <button onClick={startTimer} className="px-4 py-1.5 rounded text-white text-sm font-semibold" style={{ background: color }}>
                            Start
                        </button>
                    )}
                    {!running && secondsRemaining !== null && secondsRemaining > 0 && (
                        <button onClick={resumeTimer} className="px-4 py-1.5 rounded text-white text-sm font-semibold" style={{ background: color }}>
                            Resume
                        </button>
                    )}
                    {running && (
                        <button onClick={pauseTimer} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">
                            Pause
                        </button>
                    )}
                    {secondsRemaining !== null && (
                        <button onClick={resetTimer} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold">
                            Reset
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-1">
                    {GOAL_COLORS.map((c) => (
                        <button
                            key={c.value}
                            onClick={() => setColor(c.value)}
                            title={c.label}
                            aria-label={`Use ${c.label} color`}
                            className={`w-7 h-7 rounded-full border-2 ${color === c.value ? "border-white" : "border-transparent"}`}
                            style={{ background: c.value }}
                        />
                    ))}
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        title="Custom color"
                        aria-label="Custom color"
                        className="w-7 h-7 rounded-full border-2 border-transparent bg-transparent cursor-pointer p-0"
                    />
                </div>

                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes or instructions about this goal..."
                    rows={5}
                    className="w-full bg-gray-900 border border-gray-700 focus:border-gray-500 outline-none text-white text-sm rounded p-3 mt-2 resize-none"
                />

                {uid && (
                    <div className="w-full mt-1 border border-gray-800 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-900">
                            <button
                                onClick={() => setShowSavedTimers((v) => !v)}
                                className="flex items-center gap-2 text-sm text-gray-200 font-semibold hover:text-white"
                            >
                                <span className={`inline-block transition-transform ${showSavedTimers ? "rotate-90" : ""}`}>▸</span>
                                Saved Timers ({savedTimers.length})
                            </button>
                            <button
                                onClick={openCreateEditor}
                                className="px-2.5 py-1 rounded text-xs font-semibold text-white"
                                style={{ background: color }}
                            >
                                + Save current
                            </button>
                        </div>

                        {showSavedTimers && (
                            <div className="divide-y divide-gray-800">
                                {savedTimers.length === 0 && (
                                    <div className="px-3 py-4 text-center text-gray-500 text-xs">
                                        No saved timers yet — configure the goal above and hit "Save current".
                                    </div>
                                )}
                                {savedTimers.map((timer) => {
                                    const levelInfo = GOAL_LEVELS.find((l) => l.value === timer.level);
                                    const idle = !running && secondsRemaining === null;
                                    return (
                                        <div key={timer.id} className="flex items-center gap-2 px-3 py-2">
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: timer.color }} />
                                            <button
                                                onClick={() => applySavedTimer(timer)}
                                                disabled={!idle}
                                                title={idle ? "Load this timer" : "Reset the current timer to load a saved one"}
                                                className="flex-1 min-w-0 text-left disabled:opacity-50 disabled:cursor-not-allowed group"
                                            >
                                                <div className="text-white text-sm font-semibold truncate group-hover:underline">{timer.title}</div>
                                                <div className="text-gray-400 text-xs">
                                                    {timer.minutes} min · {levelInfo?.label ?? timer.level} · {levelInfo?.rate ?? 5} XP/min
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => openEditEditor(timer)}
                                                title="Edit saved timer"
                                                aria-label={`Edit ${timer.title}`}
                                                className="px-2 py-1 text-gray-400 hover:text-white text-sm"
                                            >
                                                ✏️
                                            </button>
                                            {confirmDeleteId === timer.id ? (
                                                <button
                                                    onClick={() => removeSavedTimer(timer.id)}
                                                    title="Confirm delete"
                                                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-semibold"
                                                >
                                                    Delete?
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => requestDeleteTimer(timer.id)}
                                                    title="Delete saved timer"
                                                    aria-label={`Delete ${timer.title}`}
                                                    className="px-2 py-1 text-gray-400 hover:text-red-400 text-sm"
                                                >
                                                    🗑
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {promptPhase === 'pause-check' && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full text-center">
                        <div className="text-white text-lg font-semibold mb-1">Finished early?</div>
                        <div className="text-gray-400 text-xs mb-5">You paused with {formatTime(secondsRemaining)} left on the clock.</div>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setPromptPhase('idle')}
                                className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-semibold"
                            >
                                No, just pausing
                            </button>
                            <button
                                onClick={() => { setFinishedEarly(true); setPromptPhase('choose-target'); }}
                                className="px-4 py-1.5 rounded text-white text-sm font-semibold"
                                style={{ background: color }}
                            >
                                Yes, I'm done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {promptPhase === 'ask' && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full text-center">
                        <div className="text-white text-lg font-semibold mb-5">Did you reach the goal?</div>
                        <div className="flex items-center justify-center gap-10">
                            <button
                                onClick={() => setPromptPhase('choose-target')}
                                title="Yes, reached the goal"
                                aria-label="Yes, reached the goal"
                                className="text-4xl hover:scale-110 transition-transform"
                            >
                                ✨
                            </button>
                            <button
                                onClick={() => setPromptPhase('declined')}
                                title="No, did not reach the goal"
                                aria-label="No, did not reach the goal"
                                className="text-4xl hover:scale-110 transition-transform"
                            >
                                ❌
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {promptPhase === 'choose-target' && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full text-center">
                        <div className="text-white text-lg font-semibold mb-1">Award {pointsEarned} XP</div>
                        <div className="text-gray-400 text-xs mb-4">{Math.round(minutesElapsed * 10) / 10} min completed · {pointsPerMinute} XP/min</div>

                        <div className="flex items-center justify-center gap-1 mb-3">
                            <button
                                onClick={() => setAwardMode('group')}
                                className={`px-3 py-1 rounded text-sm font-medium ${awardMode === 'group' ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                            >
                                Group
                            </button>
                            <button
                                onClick={() => setAwardMode('individual')}
                                className={`px-3 py-1 rounded text-sm font-medium ${awardMode === 'individual' ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                            >
                                Individual
                            </button>
                        </div>

                        {awardMode === 'group' ? (
                            characterGroups.length === 0 ? (
                                <div className="text-gray-400 text-sm mb-4">No character groups yet — assign one to characters in Class Mode first.</div>
                            ) : (
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    className="w-full bg-gray-800 text-white rounded px-2 py-2 mb-4"
                                    aria-label="Character group to award"
                                >
                                    <option value="">Select a group...</option>
                                    {characterGroups.map((group) => (
                                        <option key={group} value={group}>{group}</option>
                                    ))}
                                </select>
                            )
                        ) : (
                            characters.length === 0 ? (
                                <div className="text-gray-400 text-sm mb-4">No characters yet — create one in Class Mode first.</div>
                            ) : (
                                <select
                                    value={selectedCharacterId}
                                    onChange={(e) => setSelectedCharacterId(e.target.value)}
                                    className="w-full bg-gray-800 text-white rounded px-2 py-2 mb-4"
                                    aria-label="Character to award"
                                >
                                    <option value="">Select a character...</option>
                                    {characters.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            )
                        )}

                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setPromptPhase(finishedEarly ? 'idle' : 'declined')}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (awardMode === 'group') {
                                        if (!selectedGroup) return;
                                        onAwardGroupXp(selectedGroup, pointsEarned);
                                    } else {
                                        if (!selectedCharacterId) return;
                                        onAwardCharacterXp(selectedCharacterId, pointsEarned);
                                    }
                                    setPromptPhase('awarded');
                                }}
                                disabled={awardMode === 'group' ? !selectedGroup : !selectedCharacterId}
                                className="px-4 py-1.5 rounded text-white text-sm font-semibold disabled:opacity-50"
                                style={{ background: color }}
                            >
                                Award
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {promptPhase === 'awarded' && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full text-center">
                        <div className="text-4xl mb-2">✨</div>
                        <div className="text-white text-sm mb-4">
                            Awarded {pointsEarned} XP to {awardMode === 'group' ? selectedGroup : (characters.find((c) => c.id === selectedCharacterId)?.name ?? 'character')}!
                        </div>
                        <button onClick={resetTimer} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                            Done
                        </button>
                    </div>
                </div>
            )}

            {promptPhase === 'declined' && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full text-center">
                        <div className="text-4xl mb-2">❌</div>
                        <div className="text-white text-sm mb-4">No worries — try again next time.</div>
                        <button onClick={resetTimer} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {timerEditor && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 max-w-sm w-full">
                        <div className="text-white text-lg font-semibold mb-4">
                            {timerEditor.mode === 'create' ? 'Save timer' : 'Edit saved timer'}
                        </div>

                        <input
                            value={editorDraft.title}
                            onChange={(e) => setEditorDraft((d) => ({ ...d, title: e.target.value }))}
                            placeholder="Timer name"
                            className="w-full bg-gray-800 text-white rounded px-3 py-2 mb-3 outline-none text-sm"
                        />

                        <div className="flex items-center gap-2 mb-3">
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={editorDraft.minutes}
                                onChange={(e) => setEditorDraft((d) => ({ ...d, minutes: e.target.value }))}
                                className="w-20 bg-gray-800 text-white text-center rounded px-2 py-1.5 outline-none text-sm"
                                aria-label="Timer minutes"
                            />
                            <span className="text-gray-400 text-sm">min</span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-3">
                            {GOAL_LEVELS.map((lvl) => (
                                <button
                                    key={lvl.value}
                                    onClick={() => setEditorDraft((d) => ({ ...d, level: lvl.value }))}
                                    title={`${lvl.rate} XP per minute`}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                                        editorDraft.level === lvl.value ? "text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                                    }`}
                                    style={editorDraft.level === lvl.value ? { background: editorDraft.color } : undefined}
                                >
                                    {lvl.label} · {lvl.rate}/min
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 mb-3">
                            {GOAL_COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => setEditorDraft((d) => ({ ...d, color: c.value }))}
                                    title={c.label}
                                    aria-label={`Use ${c.label} color`}
                                    className={`w-6 h-6 rounded-full border-2 ${editorDraft.color === c.value ? "border-white" : "border-transparent"}`}
                                    style={{ background: c.value }}
                                />
                            ))}
                            <input
                                type="color"
                                value={editorDraft.color}
                                onChange={(e) => setEditorDraft((d) => ({ ...d, color: e.target.value }))}
                                title="Custom color"
                                aria-label="Custom color"
                                className="w-6 h-6 rounded-full border-2 border-transparent bg-transparent cursor-pointer p-0"
                            />
                        </div>

                        <textarea
                            value={editorDraft.notes}
                            onChange={(e) => setEditorDraft((d) => ({ ...d, notes: e.target.value }))}
                            placeholder="Notes (optional)"
                            rows={3}
                            className="w-full bg-gray-800 border border-gray-700 focus:border-gray-500 outline-none text-white text-sm rounded p-2 mb-4 resize-none"
                        />

                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setTimerEditor(null)}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveTimerEditor}
                                disabled={savingTimer || !editorDraft.title.trim() || !(Number(editorDraft.minutes) > 0)}
                                className="px-4 py-1.5 rounded text-white text-sm font-semibold disabled:opacity-50"
                                style={{ background: editorDraft.color }}
                            >
                                {savingTimer ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoalMode;
