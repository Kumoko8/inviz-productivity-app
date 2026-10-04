import React, { useState, useEffect, useCallback } from "react";
import {
    getCustomTrainingSeries,
    createCustomTrainingSeries,
    setSeriesQuestionsForLevel,
    renameCustomTopic,
    renameCustomSubtopic,
    deleteCustomTopic,
    deleteCustomTrainingSeries,
} from "../../services/customTrainingService";
import { CustomTrainingSeries, CustomQuestionItem } from "../../types/customTraining";

interface Props {
    uid?: string | null;
    onClose: () => void;
}

type Step = "topic" | "subtopic" | "questions";
type Level = 1 | 2 | 3;

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

// e.g. "Multiplication" -> "Multiplication 2" -> "Multiplication 3" if earlier names are taken
function nextAvailableName(existingNames: string[], base: string): string {
    if (!existingNames.includes(base)) return base;
    let n = 2;
    while (existingNames.includes(`${base} ${n}`)) n++;
    return `${base} ${n}`;
}

const TrainingSeriesBuilder: React.FC<Props> = ({ uid, onClose }) => {
    const [step, setStep] = useState<Step>("topic");
    const [loading, setLoading] = useState(true);
    const [allSeries, setAllSeries] = useState<CustomTrainingSeries[]>([]);

    const [topicName, setTopicName] = useState<string | null>(null);
    const [addingTopic, setAddingTopic] = useState(false);
    const [newTopicInput, setNewTopicInput] = useState("");

    const [addingSubtopic, setAddingSubtopic] = useState(false);
    const [newSubtopicInput, setNewSubtopicInput] = useState("");

    const [editingTopicName, setEditingTopicName] = useState<string | null>(null);
    const [editTopicInput, setEditTopicInput] = useState("");
    const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
    const [editSubtopicInput, setEditSubtopicInput] = useState("");

    const [series, setSeries] = useState<CustomTrainingSeries | null>(null);
    const [level, setLevel] = useState<Level>(1);
    const [questionInput, setQuestionInput] = useState("");
    const [answersInput, setAnswersInput] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pending, setPending] = useState<CustomQuestionItem[]>([]);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!uid) { setLoading(false); return; }
        setLoading(true);
        setAllSeries(await getCustomTrainingSeries(uid));
        setLoading(false);
    }, [uid]);

    useEffect(() => { load(); }, [load]);

    const topicNames = Array.from(new Set(allSeries.map(s => s.topicName)));
    const subtopicsForTopic = allSeries.filter(s => s.topicName === topicName);
    const currentQuestions = series ? series.questions[level] : [];

    const resetQuestionForm = () => {
        setQuestionInput("");
        setAnswersInput("");
        setEditingId(null);
    };

    const applySeriesUpdate = (updatedSeries: CustomTrainingSeries) => {
        setSeries(updatedSeries);
        setAllSeries(prev => prev.map(s => s.id === updatedSeries.id ? updatedSeries : s));
    };

    const handlePickTopic = (t: string) => {
        setTopicName(t);
        setStep("subtopic");
    };

    const handleCreateTopic = () => {
        const trimmed = newTopicInput.trim();
        if (!trimmed) return;
        setTopicName(trimmed);
        setNewTopicInput("");
        setAddingTopic(false);
        setStep("subtopic");
    };

    const handlePickSubtopic = (s: CustomTrainingSeries) => {
        setSeries(s);
        setLevel(1);
        resetQuestionForm();
        setPending([]);
        setStep("questions");
    };

    const handleCreateSubtopic = async () => {
        if (!uid || !topicName) return;
        const trimmed = newSubtopicInput.trim();
        if (!trimmed) return;
        const finalName = nextAvailableName(subtopicsForTopic.map(s => s.subtopicName), trimmed);
        setSaving(true);
        const created = await createCustomTrainingSeries(uid, topicName, finalName);
        setSaving(false);
        if (!created) return;
        setAllSeries(prev => [...prev, created]);
        setNewSubtopicInput("");
        setAddingSubtopic(false);
        handlePickSubtopic(created);
    };

    // --- Topic rename / delete ---

    const startEditTopic = (t: string) => {
        setEditingTopicName(t);
        setEditTopicInput(t);
    };

    const cancelEditTopic = () => {
        setEditingTopicName(null);
        setEditTopicInput("");
    };

    const handleSaveTopicRename = async () => {
        if (!uid || !editingTopicName) return;
        const trimmed = editTopicInput.trim();
        if (!trimmed || trimmed === editingTopicName) { cancelEditTopic(); return; }
        const seriesIds = allSeries.filter(s => s.topicName === editingTopicName).map(s => s.id);
        setSaving(true);
        await renameCustomTopic(uid, seriesIds, trimmed);
        setSaving(false);
        setAllSeries(prev => prev.map(s => seriesIds.includes(s.id) ? { ...s, topicName: trimmed } : s));
        if (topicName === editingTopicName) setTopicName(trimmed);
        cancelEditTopic();
    };

    const handleDeleteTopic = async (t: string) => {
        if (!uid) return;
        const seriesIds = allSeries.filter(s => s.topicName === t).map(s => s.id);
        if (!window.confirm(`Delete topic "${t}" and all ${seriesIds.length} subtopic${seriesIds.length === 1 ? "" : "s"} under it? This cannot be undone.`)) return;
        setSaving(true);
        await deleteCustomTopic(uid, seriesIds);
        setSaving(false);
        setAllSeries(prev => prev.filter(s => !seriesIds.includes(s.id)));
    };

    // --- Subtopic rename / delete ---

    const startEditSubtopic = (s: CustomTrainingSeries) => {
        setEditingSubtopicId(s.id);
        setEditSubtopicInput(s.subtopicName);
    };

    const cancelEditSubtopic = () => {
        setEditingSubtopicId(null);
        setEditSubtopicInput("");
    };

    const handleSaveSubtopicRename = async (s: CustomTrainingSeries) => {
        if (!uid) return;
        const trimmed = editSubtopicInput.trim();
        if (!trimmed || trimmed === s.subtopicName) { cancelEditSubtopic(); return; }
        setSaving(true);
        await renameCustomSubtopic(uid, s.id, trimmed);
        setSaving(false);
        setAllSeries(prev => prev.map(x => x.id === s.id ? { ...x, subtopicName: trimmed } : x));
        cancelEditSubtopic();
    };

    const handleDeleteSubtopic = async (s: CustomTrainingSeries) => {
        if (!uid) return;
        if (!window.confirm(`Delete subtopic "${s.subtopicName}"? This cannot be undone.`)) return;
        setSaving(true);
        await deleteCustomTrainingSeries(uid, s.id);
        setSaving(false);
        setAllSeries(prev => prev.filter(x => x.id !== s.id));
    };

    const handleAddToBatch = () => {
        const display = questionInput.trim();
        const answers = answersInput.split(",").map(a => a.trim()).filter(Boolean);
        if (!display || answers.length === 0) return;
        setPending(prev => [...prev, { id: genId(), display, answers }]);
        resetQuestionForm();
    };

    const handleRemovePending = (id: string) => {
        setPending(prev => prev.filter(p => p.id !== id));
    };

    const handleSubmitBatch = async () => {
        if (!uid || !series || pending.length === 0) return;
        setSaving(true);
        const updated = [...currentQuestions, ...pending];
        await setSeriesQuestionsForLevel(uid, series.id, level, updated);
        applySeriesUpdate({ ...series, questions: { ...series.questions, [level]: updated } });
        setPending([]);
        setSaving(false);
    };

    const handleStartEdit = (q: CustomQuestionItem) => {
        setEditingId(q.id);
        setQuestionInput(q.display);
        setAnswersInput(q.answers.join(", "));
    };

    const handleSaveEdit = async () => {
        if (!uid || !series || !editingId) return;
        const display = questionInput.trim();
        const answers = answersInput.split(",").map(a => a.trim()).filter(Boolean);
        if (!display || answers.length === 0) return;
        const updated = currentQuestions.map(q => q.id === editingId ? { ...q, display, answers } : q);
        setSaving(true);
        await setSeriesQuestionsForLevel(uid, series.id, level, updated);
        applySeriesUpdate({ ...series, questions: { ...series.questions, [level]: updated } });
        setSaving(false);
        resetQuestionForm();
    };

    const handleDeleteQuestion = async (id: string) => {
        if (!uid || !series) return;
        const updated = currentQuestions.filter(q => q.id !== id);
        setSaving(true);
        await setSeriesQuestionsForLevel(uid, series.id, level, updated);
        applySeriesUpdate({ ...series, questions: { ...series.questions, [level]: updated } });
        setSaving(false);
        if (editingId === id) resetQuestionForm();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[75] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold text-indigo-700">Create Training Series</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
                </div>

                {!uid ? (
                    <p className="text-center text-gray-500 py-8">You must be signed in to create a training series.</p>
                ) : loading ? (
                    <p className="text-center text-gray-500 py-8">Loading…</p>
                ) : (
                    <>
                        {step === "topic" && (
                            <>
                                <p className="text-center text-gray-500 mb-4 text-sm">Choose a topic, or create a new one</p>
                                <div className="flex flex-col gap-3">
                                    {topicNames.map(t => (
                                        <div key={t} className="flex items-center gap-2">
                                            {editingTopicName === t ? (
                                                <>
                                                    <input
                                                        autoFocus
                                                        value={editTopicInput}
                                                        onChange={e => setEditTopicInput(e.target.value)}
                                                        onKeyDown={e => e.key === "Enter" && handleSaveTopicRename()}
                                                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                                                    />
                                                    <button disabled={saving} onClick={handleSaveTopicRename} className="px-2 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">Save</button>
                                                    <button onClick={cancelEditTopic} className="px-2 py-2 text-xs text-gray-500">Cancel</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handlePickTopic(t)}
                                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-indigo-700 text-left"
                                                    >
                                                        {t}
                                                    </button>
                                                    <button onClick={() => startEditTopic(t)} title="Rename topic" className="px-2 py-2 text-gray-400 hover:text-indigo-600">✎</button>
                                                    <button onClick={() => handleDeleteTopic(t)} title="Delete topic" className="px-2 py-2 text-gray-400 hover:text-red-600">✕</button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    {addingTopic ? (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                value={newTopicInput}
                                                onChange={e => setNewTopicInput(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleCreateTopic()}
                                                placeholder="New topic name"
                                                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                                            />
                                            <button onClick={handleCreateTopic} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Next</button>
                                            <button onClick={() => { setAddingTopic(false); setNewTopicInput(""); }} className="px-3 py-2 text-sm text-gray-500">Cancel</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setAddingTopic(true)}
                                            className="w-full px-6 py-3 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-indigo-500"
                                        >
                                            + Create New Topic
                                        </button>
                                    )}
                                </div>
                                <button onClick={onClose} className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">
                                    Cancel
                                </button>
                            </>
                        )}

                        {step === "subtopic" && topicName && (
                            <>
                                <p className="text-center text-gray-500 mb-4 text-sm">
                                    Choose a subtopic for <span className="font-semibold">{topicName}</span>
                                </p>
                                <div className="flex flex-col gap-3">
                                    {subtopicsForTopic.map(s => {
                                        const count = s.questions[1].length + s.questions[2].length + s.questions[3].length;
                                        return (
                                            <div key={s.id} className="flex items-center gap-2">
                                                {editingSubtopicId === s.id ? (
                                                    <>
                                                        <input
                                                            autoFocus
                                                            value={editSubtopicInput}
                                                            onChange={e => setEditSubtopicInput(e.target.value)}
                                                            onKeyDown={e => e.key === "Enter" && handleSaveSubtopicRename(s)}
                                                            className="flex-1 border rounded-lg px-3 py-2 text-sm"
                                                        />
                                                        <button disabled={saving} onClick={() => handleSaveSubtopicRename(s)} className="px-2 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50">Save</button>
                                                        <button onClick={cancelEditSubtopic} className="px-2 py-2 text-xs text-gray-500">Cancel</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handlePickSubtopic(s)}
                                                            className="flex-1 px-6 py-3 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-indigo-700 text-left flex items-center justify-between"
                                                        >
                                                            <span>{s.subtopicName}</span>
                                                            <span className="text-xs text-gray-400 font-normal">{count} question{count === 1 ? "" : "s"}</span>
                                                        </button>
                                                        <button onClick={() => startEditSubtopic(s)} title="Rename subtopic" className="px-2 py-2 text-gray-400 hover:text-indigo-600">✎</button>
                                                        <button onClick={() => handleDeleteSubtopic(s)} title="Delete subtopic" className="px-2 py-2 text-gray-400 hover:text-red-600">✕</button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-4">
                                    {addingSubtopic ? (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                value={newSubtopicInput}
                                                onChange={e => setNewSubtopicInput(e.target.value)}
                                                onKeyDown={e => e.key === "Enter" && handleCreateSubtopic()}
                                                placeholder="New subtopic name"
                                                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                                            />
                                            <button disabled={saving} onClick={handleCreateSubtopic} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Next</button>
                                            <button onClick={() => { setAddingSubtopic(false); setNewSubtopicInput(""); }} className="px-3 py-2 text-sm text-gray-500">Cancel</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setAddingSubtopic(true)}
                                            className="w-full px-6 py-3 rounded-xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition font-bold text-indigo-500"
                                        >
                                            + Create New Subtopic
                                        </button>
                                    )}
                                </div>
                                <button onClick={() => { setStep("topic"); setTopicName(null); }} className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">
                                    ← Back
                                </button>
                            </>
                        )}

                        {step === "questions" && series && (
                            <>
                                <p className="text-center text-gray-500 mb-1 text-sm">
                                    <span className="font-semibold">{series.topicName}</span> · {series.subtopicName}
                                </p>
                                <div className="flex justify-center gap-2 mb-4 mt-3">
                                    {([1, 2, 3] as Level[]).map(lv => (
                                        <button
                                            key={lv}
                                            onClick={() => { setLevel(lv); resetQuestionForm(); }}
                                            className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition ${level === lv ? "border-indigo-600 bg-indigo-600 text-white" : "border-indigo-200 text-indigo-600 hover:border-indigo-400"}`}
                                        >
                                            L{lv} ({series.questions[lv].length})
                                        </button>
                                    ))}
                                </div>

                                <div className="max-h-40 overflow-y-auto border rounded-lg mb-4 divide-y">
                                    {currentQuestions.length === 0 ? (
                                        <p className="text-center text-gray-400 text-sm py-4">No questions yet for Level {level}</p>
                                    ) : currentQuestions.map(q => (
                                        <div key={q.id} className="flex items-start justify-between gap-2 p-2 text-sm">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-gray-800 break-words">{q.display}</div>
                                                <div className="text-gray-400 text-xs break-words">Answers: {q.answers.join(", ")}</div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button onClick={() => handleStartEdit(q)} className="text-xs text-indigo-500 hover:text-indigo-700 px-1">Edit</button>
                                                <button onClick={() => handleDeleteQuestion(q.id)} className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="border rounded-lg p-3 bg-gray-50">
                                    <label className="text-xs font-semibold text-gray-500">Question (Level {level})</label>
                                    <textarea
                                        value={questionInput}
                                        onChange={e => setQuestionInput(e.target.value)}
                                        placeholder="Type or paste the question…"
                                        rows={3}
                                        className="w-full border rounded-lg px-3 py-2 text-sm mt-1 mb-2"
                                    />
                                    <label className="text-xs font-semibold text-gray-500">Accepted answers (comma-separated)</label>
                                    <input
                                        value={answersInput}
                                        onChange={e => setAnswersInput(e.target.value)}
                                        placeholder="e.g. 42, forty-two"
                                        className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                                    />
                                    <div className="flex gap-2 mt-3">
                                        {editingId ? (
                                            <>
                                                <button disabled={saving} onClick={handleSaveEdit} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Save Changes</button>
                                                <button onClick={resetQuestionForm} className="px-3 py-1.5 text-sm text-gray-500">Cancel Edit</button>
                                            </>
                                        ) : (
                                            <button onClick={handleAddToBatch} className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-200">
                                                + Add to Batch
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {pending.length > 0 && (
                                    <div className="mt-3 border border-indigo-200 rounded-lg p-3 bg-indigo-50">
                                        <div className="text-xs font-semibold text-indigo-600 mb-2">Ready to submit ({pending.length})</div>
                                        <div className="flex flex-col gap-1 mb-3 max-h-28 overflow-y-auto">
                                            {pending.map(p => (
                                                <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1">
                                                    <span className="truncate">{p.display}</span>
                                                    <button onClick={() => handleRemovePending(p.id)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <button disabled={saving} onClick={handleSubmitBatch} className="w-full px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                                            {saving ? "Saving…" : `Submit ${pending.length} Question${pending.length > 1 ? "s" : ""}`}
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => { setStep("subtopic"); setSeries(null); setPending([]); resetQuestionForm(); }}
                                    className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition"
                                >
                                    ← Back
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TrainingSeriesBuilder;
