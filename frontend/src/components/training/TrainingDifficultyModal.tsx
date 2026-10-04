import React, { useState, useEffect, useCallback } from "react";
import TrainingCharacterSelect, { CharacterOption } from "./TrainingCharacterSelect";
import TrainingSeriesBuilder from "./TrainingSeriesBuilder";
import { getCustomTrainingSeries } from "../../services/customTrainingService";
import { CustomTrainingSeries } from "../../types/customTraining";
import { Topic, Subtopic, SubtopicLevel, TOPIC_LABELS, SUBTOPIC_LABELS, TOPIC_SUBTOPICS, SUBTOPIC_LEVEL_BONUS } from "../../utils/trainingUtils";

const TOPIC_COLORS: Record<Topic, { border: string; hover: string; label: string }> = {
    math: { border: "border-purple-200", hover: "hover:border-purple-500 hover:bg-purple-50", label: "text-purple-700" },
    science: { border: "border-emerald-200", hover: "hover:border-emerald-500 hover:bg-emerald-50", label: "text-emerald-700" },
    japanese: { border: "border-red-200", hover: "hover:border-red-500 hover:bg-red-50", label: "text-red-700" },
    reading: { border: "border-amber-200", hover: "hover:border-amber-500 hover:bg-amber-50", label: "text-amber-700" },
    ACT: { border: "border-green-400", hover: "hover:border-green-500 hover:bg-green-50", label: "text-green-700" },
    korean: { border: "border-blue-200", hover: "hover:border-blue-500 hover:bg-blue-50", label: "text-blue-700" },
    history: { border: "border-orange-400", hover: "hover:border-orange-500 hover:bg-orange-50", label: "text-orange-700" },
    ISEE: { border: "border-teal-300", hover: "hover:border-teal-500 hover:bg-teal-50", label: "text-teal-700" },
};

// Styling for user-created custom topics/subtopics (not part of the fixed Topic union)
const CUSTOM_COLOR = { border: "border-indigo-200", hover: "hover:border-indigo-500 hover:bg-indigo-50", label: "text-indigo-700" };
const CUSTOM_LEVEL_BONUS: Record<SubtopicLevel, number> = { 1: 0, 2: 50, 3: 100 };

export type DifficultySelection =
    | { kind: "builtin"; subtopic: Subtopic; level: SubtopicLevel }
    | { kind: "custom"; series: CustomTrainingSeries; level: SubtopicLevel };

interface Props {
    uid?: string | null;
    allCharacters: CharacterOption[];
    onSelect: (selection: DifficultySelection, characters: CharacterOption[]) => void;
    onCancel: () => void;
    skipCharacters?: boolean;
}

type Step = "topic" | "subtopic" | "level" | "characters";

const TrainingDifficultyModal: React.FC<Props> = ({ uid, allCharacters, onSelect, onCancel, skipCharacters }) => {
    const [step, setStep] = useState<Step>("topic");
    const [topic, setTopic] = useState<Topic | null>(null);
    const [customTopicName, setCustomTopicName] = useState<string | null>(null);
    const [subtopic, setSubtopic] = useState<Subtopic | null>(null);
    const [customSeries, setCustomSeries] = useState<CustomTrainingSeries | null>(null);
    const [level, setLevel] = useState<SubtopicLevel | null>(null);
    const [showBuilder, setShowBuilder] = useState(false);
    const [allCustomSeries, setAllCustomSeries] = useState<CustomTrainingSeries[]>([]);

    const loadCustom = useCallback(async () => {
        if (!uid) { setAllCustomSeries([]); return; }
        setAllCustomSeries(await getCustomTrainingSeries(uid));
    }, [uid]);

    useEffect(() => { loadCustom(); }, [loadCustom]);

    const customTopicNames = Array.from(new Set(allCustomSeries.map(s => s.topicName)));
    const customSeriesForTopic = customTopicName ? allCustomSeries.filter(s => s.topicName === customTopicName) : [];

    const emitSelection = (lv: SubtopicLevel, chars: CharacterOption[]) => {
        if (customSeries) {
            onSelect({ kind: "custom", series: customSeries, level: lv }, chars);
        } else if (subtopic) {
            onSelect({ kind: "builtin", subtopic, level: lv }, chars);
        }
    };

    const handleTopicPick = (t: Topic) => {
        setTopic(t);
        setCustomTopicName(null);
        setStep("subtopic");
    };

    const handleCustomTopicPick = (name: string) => {
        setCustomTopicName(name);
        setTopic(null);
        setStep("subtopic");
    };

    const handleSubtopicPick = (s: Subtopic) => {
        setSubtopic(s);
        setCustomSeries(null);
        if (s === 'story_reader' || s === 'equations') {
            // These have their own level/flow — skip the level step, go to character select
            setLevel(1);
            setStep("characters");
            return;
        }
        setStep("level");
    };

    const handleCustomSubtopicPick = (s: CustomTrainingSeries) => {
        setCustomSeries(s);
        setSubtopic(null);
        setStep("level");
    };

    const handleLevelPick = (lv: SubtopicLevel) => {
        setLevel(lv);
        if (skipCharacters) {
            emitSelection(lv, allCharacters);
        } else {
            setStep("characters");
        }
    };

    const handleCharactersConfirm = (chars: CharacterOption[]) => {
        if (!level) return;
        emitSelection(level, chars);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain">
                <h2 className="text-2xl font-bold text-center mb-2 text-purple-700">Training Mode</h2>

                {step === "topic" && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">Choose a topic to study</p>
                        <div className="flex flex-col gap-4">
                            {(Object.keys(TOPIC_SUBTOPICS) as Topic[]).filter(t => TOPIC_SUBTOPICS[t].length > 0).map(t => {
                                const c = TOPIC_COLORS[t];
                                return (
                                    <button
                                        key={t}
                                        onClick={() => handleTopicPick(t)}
                                        className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 ${c.border} ${c.hover} transition group`}
                                    >
                                        <span className={`font-bold text-lg ${c.label}`}>{TOPIC_LABELS[t]}</span>
                                        <span className="text-xs text-gray-400 ml-auto">
                                            {TOPIC_SUBTOPICS[t].map(s => SUBTOPIC_LABELS[s]).join(" · ")}
                                        </span>
                                    </button>
                                );
                            })}
                            {customTopicNames.map(name => (
                                <button
                                    key={name}
                                    onClick={() => handleCustomTopicPick(name)}
                                    className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 ${CUSTOM_COLOR.border} ${CUSTOM_COLOR.hover} transition group`}
                                >
                                    <span className={`font-bold text-lg ${CUSTOM_COLOR.label}`}>{name}</span>
                                    <span className="text-xs text-gray-400 ml-auto">
                                        {allCustomSeries.filter(s => s.topicName === name).map(s => s.subtopicName).join(" · ")}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowBuilder(true)}
                            className="mt-4 w-full px-6 py-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition font-bold text-gray-400 hover:text-purple-600"
                        >
                            + Create New
                        </button>
                        <button onClick={onCancel} className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">
                            Cancel
                        </button>
                    </>
                )}

                {step === "subtopic" && (topic || customTopicName) && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            Choose a subtopic for <span className="font-semibold">{topic ? TOPIC_LABELS[topic] : customTopicName}</span>
                        </p>
                        <div className="flex flex-col gap-3">
                            {topic && TOPIC_SUBTOPICS[topic].map(s => {
                                const c = TOPIC_COLORS[topic];
                                return (
                                    <button
                                        key={s}
                                        onClick={() => handleSubtopicPick(s)}
                                        className={`px-6 py-4 rounded-xl border-2 ${c.border} ${c.hover} transition font-bold text-lg ${c.label} text-left`}
                                    >
                                        {SUBTOPIC_LABELS[s]}
                                    </button>
                                );
                            })}
                            {customTopicName && customSeriesForTopic.map(s => {
                                const count = s.questions[1].length + s.questions[2].length + s.questions[3].length;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => handleCustomSubtopicPick(s)}
                                        className={`px-6 py-4 rounded-xl border-2 ${CUSTOM_COLOR.border} ${CUSTOM_COLOR.hover} transition font-bold text-lg ${CUSTOM_COLOR.label} text-left flex items-center justify-between`}
                                    >
                                        <span>{s.subtopicName}</span>
                                        <span className="text-xs text-gray-400 font-normal">{count} question{count === 1 ? "" : "s"}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setStep("topic")} className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">
                            ← Back
                        </button>
                    </>
                )}

                {step === "level" && (subtopic || customSeries) && (
                    <>
                        <p className="text-center text-gray-500 mb-6 text-sm">
                            Choose a level for <span className="font-semibold">{subtopic ? SUBTOPIC_LABELS[subtopic] : customSeries!.subtopicName}</span>
                        </p>
                        <div className="flex flex-col gap-3">
                            {([1, 2, 3] as SubtopicLevel[]).map(lv => {
                                const bonus = subtopic ? SUBTOPIC_LEVEL_BONUS[subtopic][lv] : CUSTOM_LEVEL_BONUS[lv];
                                const c = topic ? TOPIC_COLORS[topic] : CUSTOM_COLOR;
                                return (
                                    <button
                                        key={lv}
                                        onClick={() => handleLevelPick(lv)}
                                        className={`flex items-center justify-between px-6 py-4 rounded-xl border-2 ${c.border} ${c.hover} transition`}
                                    >
                                        <span className={`font-bold text-lg ${c.label}`}>Level {lv}</span>
                                        <span className="text-sm text-gray-400">
                                            {bonus > 0 ? `+${bonus} XP bonus` : "Base XP"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setStep("subtopic")} className="mt-6 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-800 transition">
                            ← Back
                        </button>
                    </>
                )}

                {step === "characters" && (
                    <TrainingCharacterSelect
                        characters={allCharacters}
                        onConfirm={handleCharactersConfirm}
                        onBack={() => setStep("level")}
                    />
                )}
            </div>

            {showBuilder && (
                <TrainingSeriesBuilder uid={uid} onClose={() => { setShowBuilder(false); loadCustom(); }} />
            )}
        </div>
    );
};

export default TrainingDifficultyModal;

