import React, { useState } from "react";
import { useUser } from "../../context/UserContext";
import { createLesson, type UploadProgress } from "../../services/lessonService";

interface Props {
    existingTopics: { id: string; label: string }[];
    onCreated: () => void;
    onCancel: () => void;
}

const sanitizeSegment = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

const CreateLessonForm: React.FC<Props> = ({ existingTopics, onCreated, onCancel }) => {
    const { user } = useUser();
    const [mode, setMode] = useState<"pick" | "new">("pick");
    const [topicId, setTopicId] = useState<string>(existingTopics[0]?.id ?? "");
    const [newTopic, setNewTopic] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [captions, setCaptions] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress>({ uploaded: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);

    const topic = mode === "new" ? sanitizeSegment(newTopic) : topicId;

    const onPickFiles = (list: FileList | null) => {
        if (!list) return;
        const picked = [...files, ...Array.from(list).filter(f => f.type.startsWith("image/"))];
        setFiles(picked);
        setCaptions(prev => {
            const next = [...prev];
            while (next.length < picked.length) next.push("");
            return next;
        });
    };

    const removeFile = (i: number) => {
        setFiles(files.filter((_, idx) => idx !== i));
        setCaptions(captions.filter((_, idx) => idx !== i));
    };

    const moveFile = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= files.length) return;
        const f = [...files];
        [f[i], f[j]] = [f[j], f[i]];
        setFiles(f);
        const c = [...captions];
        [c[i], c[j]] = [c[j], c[i]];
        setCaptions(c);
    };

    const canSubmit =
        !!user && !!topic && !!title.trim() && files.length > 0 && !uploading;

    const submit = async () => {
        if (!user || !canSubmit) return;
        setUploading(true);
        setError(null);
        try {
            await createLesson(
                user.uid,
                {
                    title,
                    description,
                    topic,
                    captions,
                    files,
                },
                setProgress
            );
            onCreated();
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Upload failed: ${msg}`);
            setUploading(false);
        }
    };

    const inputCls =
        "w-full bg-white/5 text-white text-sm px-3 py-2 rounded-lg border border-white/10 outline-none placeholder-white/25 focus:border-white/25 transition-colors";

    return (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
                    <h3 className="text-white font-bold text-lg">Create Lesson</h3>
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
                            Pages ({files.length})
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

                        {files.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                                {files.map((f, i) => (
                                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                                        <img
                                            src={URL.createObjectURL(f)}
                                            alt=""
                                            className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                                            <div className="text-white/60 text-xs truncate">{i + 1}. {f.name}</div>
                                            <input
                                                value={captions[i] ?? ""}
                                                onChange={e => setCaptions(captions.map((c, idx) => idx === i ? e.target.value : c))}
                                                placeholder="Caption (optional)"
                                                className="bg-white/5 text-white/80 text-xs px-2 py-1 rounded border border-white/10 outline-none placeholder-white/25"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                                            <button onClick={() => moveFile(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1">▲</button>
                                            <button onClick={() => moveFile(i, 1)} disabled={i === files.length - 1} className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1">▼</button>
                                            <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
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
                                Uploading {progress.uploaded}/{progress.total}…
                            </p>
                        </div>
                    )}
                    <button
                        onClick={submit}
                        disabled={!canSubmit}
                        className="w-full py-2.5 bg-yellow-600/80 hover:bg-yellow-500/90 text-white rounded-xl font-bold transition-colors disabled:opacity-30"
                    >
                        {uploading ? "Uploading…" : "Create Lesson"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateLessonForm;
