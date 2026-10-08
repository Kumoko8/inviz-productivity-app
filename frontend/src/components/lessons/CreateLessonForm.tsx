import React, { useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";
import SlideEditor from "./SlideEditor";
import { useStorageUrl } from "../../hooks/useLessonImages";
import type { CustomSlideSettings, Lesson } from "./lessonsData";
import { createLesson, updateLesson, type UploadProgress } from "../../services/lessonService";

interface Props {
    existingTopics: { id: string; label: string }[];
    /** When provided, the form edits this lesson instead of creating a new one */
    lesson?: Lesson;
    onCreated: () => void;
    onCancel: () => void;
}

const sanitizeSegment = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

interface PageItem {
    key: number;
    /** Existing page already in Storage */
    storagePath?: string;
    /** Newly added image, uploaded on submit */
    file?: File;
    caption: string;
    customSlide?: CustomSlideSettings;
}

let keyCounter = 0;
const nextKey = () => ++keyCounter;

const PageThumb: React.FC<{ item: PageItem }> = ({ item }) => {
    const [objUrl, setObjUrl] = useState("");
    useEffect(() => {
        if (!item.file) return;
        const u = URL.createObjectURL(item.file);
        setObjUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [item.file]);
    const { url } = useStorageUrl(item.file ? "" : item.storagePath ?? "");
    return <img src={item.file ? objUrl : url} alt="" className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-gray-700" />;
};

const CreateLessonForm: React.FC<Props> = ({ existingTopics, lesson, onCreated, onCancel }) => {
    const { user } = useUser();
    const editing = !!lesson;
    const [mode, setMode] = useState<"pick" | "new">("pick");
    const [topicId, setTopicId] = useState<string>(lesson?.topic ?? existingTopics[0]?.id ?? "");
    const [newTopic, setNewTopic] = useState("");
    const [title, setTitle] = useState(lesson?.title ?? "");
    const [description, setDescription] = useState(lesson?.description ?? "");
    const [items, setItems] = useState<PageItem[]>(
        () => (lesson?.pages ?? []).map(p => ({ key: nextKey(), storagePath: p.storagePath, caption: p.caption ?? "" }))
    );
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress>({ uploaded: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [showSlideEditor, setShowSlideEditor] = useState(false);
    const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);

    const topic = mode === "new" ? sanitizeSegment(newTopic) : topicId;

    const onPickFiles = (list: FileList | null) => {
        if (!list) return;
        addFiles(Array.from(list));
    };

    const addFiles = (list: File[]) => {
        const added = list
            .filter(f => f.type.startsWith("image/"))
            .map(file => ({ key: nextKey(), file, caption: "" }));
        setItems(prev => [...prev, ...added]);
    };

    const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

    const moveItem = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[i], next[j]] = [next[j], next[i]];
        setItems(next);
    };

    const setCaption = (i: number, caption: string) =>
        setItems(items.map((it, idx) => (idx === i ? { ...it, caption } : it)));

    const canSubmit =
        !!user && !!topic && !!title.trim() && items.length > 0 && !uploading;

    const submit = async () => {
        if (!user || !canSubmit) return;
        setUploading(true);
        setError(null);
        try {
            if (lesson) {
                await updateLesson(
                    user.uid,
                    lesson,
                    {
                        title,
                        description,
                        topic,
                        pages: items.map(it => ({
                            storagePath: it.storagePath,
                            file: it.file,
                            caption: it.caption,
                            customSlide: it.customSlide,
                        })),
                    },
                    setProgress
                );
            } else {
                await createLesson(
                    user.uid,
                    {
                        title,
                        description,
                        topic,
                        captions: items.map(it => it.caption),
                        customSlides: items.map(it => it.customSlide),
                        files: items.map(it => it.file!),
                    },
                    setProgress
                );
            }
            onCreated();
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : String(e);
            setError(`${editing ? "Save" : "Upload"} failed: ${msg}`);
            setUploading(false);
        }
    };

    const inputCls =
        "w-full bg-white/5 text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25 transition-colors";

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <h3 className="text-white font-bold text-lg">{editing ? "Edit Lesson" : "Create Lesson"}</h3>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white text-xl" disabled={uploading}>✕</button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
                    {/* Topic */}
                    <div>
                        <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Topic</label>
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setMode("pick")}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition ${mode === "pick" ? "bg-yellow-400/20 border-yellow-400 text-yellow-300" : "bg-gray-800 border-gray-600 text-gray-300"}`}
                            >
                                Choose existing
                            </button>
                            <button
                                onClick={() => setMode("new")}
                                className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition ${mode === "new" ? "bg-yellow-400/20 border-yellow-400 text-yellow-300" : "bg-gray-800 border-gray-600 text-gray-300"}`}
                            >
                                Create new
                            </button>
                        </div>
                        {mode === "pick" ? (
                            <select value={topicId} onChange={e => setTopicId(e.target.value)} className={inputCls}>
                                {existingTopics.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                value={newTopic}
                                onChange={e => setNewTopic(e.target.value)}
                                placeholder="New topic name…"
                                className={inputCls}
                            />
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Lesson title</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="e.g. Similes"
                            className={inputCls}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Description (optional)</label>
                        <input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Short description shown on the card"
                            className={inputCls}
                        />
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
                            Pages ({items.length})
                        </label>
                        <label className="flex items-center justify-center gap-2 border border-dashed border-gray-600 rounded-xl py-4 text-gray-400 hover:text-white hover:border-gray-400 cursor-pointer transition text-sm">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={e => { onPickFiles(e.target.files); e.target.value = ""; }}
                            />
                            ＋ Add images
                        </label>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingSlideIndex(null);
                                setShowSlideEditor(true);
                            }}
                            className="mt-2 w-full py-2 border border-yellow-400/40 rounded-xl text-yellow-300 hover:bg-yellow-400/10 transition text-sm"
                        >
                            ✎ Create custom slide
                        </button>

                        {items.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                                {items.map((it, i) => (
                                    <div key={it.key} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                        <PageThumb item={it} />
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <div className="text-white/60 text-xs truncate">
                                                {i + 1}. {it.file ? it.file.name : "Existing page"}
                                            </div>
                                            <input
                                                value={it.caption}
                                                onChange={e => setCaption(i, e.target.value)}
                                                placeholder="Caption (optional)"
                                                className="bg-white/5 text-white/80 text-xs px-2 py-1 rounded border border-white/10 outline-none placeholder-white/25"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                                            {it.customSlide && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingSlideIndex(i);
                                                        setShowSlideEditor(true);
                                                    }}
                                                    disabled={uploading}
                                                    aria-label={`Edit custom slide ${i + 1}`}
                                                    className="text-yellow-300 hover:text-yellow-200 text-xs px-1"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1">▲</button>
                                            <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1">▼</button>
                                            <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                </div>

                <div className="px-5 py-4 border-t border-gray-700">
                    {uploading && (
                        <div className="mb-3">
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-yellow-400 rounded-full transition-all"
                                    style={{ width: progress.total ? `${(progress.uploaded / progress.total) * 100}%` : "0%" }}
                                />
                            </div>
                            <p className="text-gray-400 text-xs mt-1 text-center">
                                {editing ? "Uploading new images" : "Uploading"} {progress.uploaded}/{progress.total}…
                            </p>
                        </div>
                    )}
                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        className="w-full py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-30"
                    >
                        {uploading ? (editing ? "Saving…" : "Uploading…") : editing ? "Save Changes" : "Create Lesson"}
                    </button>
                </div>
            </div>
            {showSlideEditor && (
                <SlideEditor
                    key={editingSlideIndex === null ? "new-slide" : `edit-slide-${items[editingSlideIndex]?.key}`}
                    initialValue={editingSlideIndex === null ? undefined : items[editingSlideIndex]?.customSlide}
                    onCancel={() => {
                        setEditingSlideIndex(null);
                        setShowSlideEditor(false);
                    }}
                    onSave={(file, customSlide) => {
                        if (editingSlideIndex === null) {
                            setItems(prev => [...prev, { key: nextKey(), file, caption: "", customSlide }]);
                        } else {
                            setItems(prev => prev.map((item, index) =>
                                index === editingSlideIndex ? { ...item, file, customSlide } : item
                            ));
                        }
                        setEditingSlideIndex(null);
                        setShowSlideEditor(false);
                    }}
                />
            )}
        </div>
    );
};

export default CreateLessonForm;
