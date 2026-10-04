import { db, storage } from "../firebase";
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    type DocumentData,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import type { Lesson, LessonPage } from "../components/lessons/lessonsData";

function lessonsRef(uid: string) {
    return collection(db, "users", uid, "lessons");
}

export interface FirestoreLesson extends Lesson {
    createdAt?: number;
}

function docToLesson(id: string, data: DocumentData): FirestoreLesson {
    return {
        id,
        title: data.title ?? "Untitled",
        description: data.description,
        topic: data.topic ?? "general",
        pages: (data.pages as LessonPage[]) ?? [],
        thumbnailPath: data.thumbnailPath,
        createdAt: data.createdAt?.toMillis?.(),
    };
}

export async function loadLessons(uid: string): Promise<FirestoreLesson[]> {
    const snap = await getDocs(query(lessonsRef(uid), orderBy("createdAt", "desc")));
    return snap.docs.map(d => docToLesson(d.id, d.data()));
}

export interface NewLessonInput {
    title: string;
    description?: string;
    topic: string;
    captions: string[];
    files: File[];
}

export interface UploadProgress {
    uploaded: number;
    total: number;
}

const sanitizeSegment = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "untitled";

/**
 * Uploads images to Storage under lessons/<topic-slug>/<title-slug>/ and saves
 * the lesson metadata (topic, title, captions, storage paths) to Firestore.
 */
export async function createLesson(
    uid: string,
    input: NewLessonInput,
    onProgress?: (p: UploadProgress) => void
): Promise<void> {
    const { title, description, topic, captions, files } = input;
    const folder = `users/${uid}/lessons/${sanitizeSegment(topic)}/${sanitizeSegment(title)}`;

    const pages: LessonPage[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
        const suffix = Math.random().toString(36).slice(2, 10);
        const path = `${folder}/${String(i + 1).padStart(2, "0")}_${suffix}.${ext}`;
        await uploadBytes(ref(storage, path), file);
        const caption = captions[i]?.trim();
        pages.push(caption ? { storagePath: path, caption } : { storagePath: path });
        onProgress?.({ uploaded: i + 1, total: files.length });
    }

    // Firestore rejects `undefined` field values, so only include optional fields when set.
    const trimmedDescription = description?.trim();
    await addDoc(lessonsRef(uid), {
        title: title.trim(),
        topic,
        pages,
        thumbnailPath: pages[0]?.storagePath,
        createdAt: serverTimestamp(),
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
    });
}
