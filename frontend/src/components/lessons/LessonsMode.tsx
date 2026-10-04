import React, { useEffect, useState, useCallback } from "react";
import { LESSON_TOPICS, Lesson, LessonTopic } from "./lessonsData";
import LessonViewer from "./LessonViewer";
import CreateLessonForm from "./CreateLessonForm";
import { useStorageUrl } from "../../hooks/useLessonImages";
import { loadLessons, type FirestoreLesson } from "../../services/lessonService";
import { useUser } from "../../context/UserContext";

interface Props {
    onClose: () => void;
}

const topicMeta = (id: string): LessonTopic => {
    const known = LESSON_TOPICS.find(t => t.id === id);
    if (known) return known;
    return {
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        color: "bg-cyan-700",
        icon: "📚",
    };
};

const LessonsMode: React.FC<Props> = ({ onClose }) => {
    const { user } = useUser();
    const [lessons, setLessons] = useState<FirestoreLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    const refresh = useCallback(() => {
        if (!user) { setLoading(false); return; }
        setLoading(true);
        loadLessons(user.uid)
            .then(setLessons)
            .catch(console.warn)
            .finally(() => setLoading(false));
    }, [user]);

    useEffect(() => { refresh(); }, [refresh]);

    // Topics present in the user's lessons, with static ones first for stability
    const topics: LessonTopic[] = (() => {
        const ids = [...new Set(lessons.map(l => l.topic))];
        const staticIds = LESSON_TOPICS.map(t => t.id);
        const ordered = [
            ...staticIds.filter(id => ids.includes(id)),
            ...ids.filter(id => !staticIds.includes(id)),
        ];
        return ordered.map(topicMeta);
    })();

    const filtered = selectedTopic
        ? lessons.filter((l) => l.topic === selectedTopic)
        : lessons;

    if (openLesson) {
        return <LessonViewer lesson={openLesson} onClose={() => setOpenLesson(null)} />;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex flex-col overflow-auto">
            <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Lessons Library</h2>
                        <p className="text-gray-400 text-sm mt-0.5">
                            Select a topic below then open any lesson to begin.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {user && (
                            <button
                                onClick={() => setShowCreate(true)}
                                className="px-4 py-2 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                                ＋ Create Lesson
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium"
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Topic filter chips */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setSelectedTopic(null)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                            selectedTopic === null
                                ? "bg-white text-gray-900 border-white"
                                : "bg-transparent text-gray-300 border-gray-600 hover:border-gray-400"
                        }`}
                    >
                        All
                    </button>
                    {topics.map((t) => {
                        const count = lessons.filter((l) => l.topic === t.id).length;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTopic(t.id === selectedTopic ? null : t.id)}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                                    selectedTopic === t.id
                                        ? "bg-white text-gray-900 border-white"
                                        : "bg-transparent text-gray-300 border-gray-600 hover:border-gray-400"
                                }`}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                                <span className="bg-gray-700 text-gray-300 text-xs px-1.5 rounded-full">
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Lesson grid */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <svg className="animate-spin w-8 h-8 text-gray-500" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                    </div>
                ) : filtered.length === 0 ? (
                    <EmptyState
                        topic={selectedTopic ? topicMeta(selectedTopic) : null}
                        canCreate={!!user}
                        onCreate={() => setShowCreate(true)}
                    />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {filtered.map((lesson) => (
                            <LessonCard
                                key={lesson.id}
                                lesson={lesson}
                                topic={topicMeta(lesson.topic)}
                                onOpen={() => setOpenLesson(lesson)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showCreate && (
                <CreateLessonForm
                    existingTopics={topics}
                    onCreated={() => { setShowCreate(false); refresh(); }}
                    onCancel={() => setShowCreate(false)}
                />
            )}
        </div>
    );
};

// ── Lesson card with lazy thumbnail ──────────────────────────────────────────
const LessonCard: React.FC<{
    lesson: Lesson;
    topic: LessonTopic | null;
    onOpen: () => void;
}> = ({ lesson, topic, onOpen }) => {
    const thumbPath = lesson.thumbnailPath ?? lesson.pages[0]?.storagePath ?? "";
    const { url: thumbUrl, loading: thumbLoading } = useStorageUrl(thumbPath);

    return (
        <button
            onClick={onOpen}
            className="group text-left bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-500 transition shadow-md hover:shadow-lg"
        >
            {/* Thumbnail */}
            <div className="aspect-video w-full bg-gray-700 overflow-hidden relative flex items-center justify-center">
                {thumbLoading && (
                    <svg className="animate-spin w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                )}
                {!thumbLoading && thumbUrl && (
                    <img
                        src={thumbUrl}
                        alt={lesson.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                )}
                {!thumbLoading && !thumbUrl && (
                    <span className="text-4xl">{topic?.icon ?? "📄"}</span>
                )}
                {/* Topic badge */}
                {topic && (
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-semibold text-white ${topic.color}`}>
                        {topic.icon} {topic.label}
                    </span>
                )}
            </div>
            {/* Info */}
            <div className="p-3">
                <h3 className="text-white font-semibold text-sm leading-snug mb-1 group-hover:text-yellow-300 transition">
                    {lesson.title}
                </h3>
                {lesson.description && (
                    <p className="text-gray-400 text-xs line-clamp-2">{lesson.description}</p>
                )}
                <p className="text-gray-500 text-xs mt-2">
                    {lesson.pages.length} page{lesson.pages.length !== 1 ? "s" : ""}
                </p>
            </div>
        </button>
    );
};

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ topic: LessonTopic | null; canCreate: boolean; onCreate: () => void }> = ({ topic, canCreate, onCreate }) => (
    <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
        <span className="text-6xl mb-4">{topic?.icon ?? "📚"}</span>
        <h3 className="text-white text-lg font-semibold mb-2">
            {topic ? `No ${topic.label} lessons yet` : "No lessons yet"}
        </h3>
        {canCreate ? (
            <>
                <p className="text-gray-400 text-sm max-w-xs mb-4">
                    Create your first lesson by uploading image pages.
                </p>
                <button
                    onClick={onCreate}
                    className="px-5 py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold text-sm transition-colors"
                >
                    ＋ Create Lesson
                </button>
            </>
        ) : (
            <p className="text-gray-400 text-sm max-w-xs">
                Sign in to create and view lessons.
            </p>
        )}
    </div>
);

export default LessonsMode;
