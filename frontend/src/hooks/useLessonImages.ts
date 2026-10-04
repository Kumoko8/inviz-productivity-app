import { useState, useEffect } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../firebase";
import { Lesson } from "../components/lessons/lessonsData";

async function resolveStoragePath(path: string): Promise<string> {
    if (!path) return "";
    try {
        return await getDownloadURL(ref(storage, path));
    } catch {
        // strip accidental leading slash and retry
        const stripped = path.replace(/^\/+/, "");
        if (stripped !== path) {
            try {
                return await getDownloadURL(ref(storage, stripped));
            } catch { /* fall through */ }
        }
        console.warn("useLessonImages: could not resolve", path);
        return "";
    }
}

export interface ResolvedPage {
    url: string;
    caption?: string;
}

interface UseLessonImagesResult {
    pages: ResolvedPage[];
    thumbnail: string;
    loading: boolean;
}

/**
 * Resolves all Storage paths in a Lesson to signed download URLs.
 * Re-runs whenever the lesson id changes.
 */
export function useLessonImages(lesson: Lesson): UseLessonImagesResult {
    const [pages, setPages] = useState<ResolvedPage[]>([]);
    const [thumbnail, setThumbnail] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setPages([]);
        setThumbnail("");

        (async () => {
            // Resolve all pages in parallel
            const resolved = await Promise.all(
                lesson.pages.map(async (p) => ({
                    url: await resolveStoragePath(p.storagePath),
                    caption: p.caption,
                }))
            );

            // Resolve explicit thumbnail path, or fall back to first page
            const thumbPath = lesson.thumbnailPath ?? lesson.pages[0]?.storagePath ?? "";
            const thumb = thumbPath
                ? lesson.thumbnailPath
                    ? await resolveStoragePath(thumbPath)
                    : (resolved[0]?.url ?? "")
                : "";

            if (!cancelled) {
                setPages(resolved);
                setThumbnail(thumb);
                setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [lesson.id]); // eslint-disable-line react-hooks/exhaustive-deps

    return { pages, thumbnail, loading };
}

/**
 * Resolves a single Storage path to a download URL.
 * Used for lazy thumbnail loading in the lesson library cards.
 */
export function useStorageUrl(storagePath: string): { url: string; loading: boolean } {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(!!storagePath);

    useEffect(() => {
        if (!storagePath) { setUrl(""); setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
        resolveStoragePath(storagePath).then((resolved) => {
            if (!cancelled) { setUrl(resolved); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [storagePath]);

    return { url, loading };
}
