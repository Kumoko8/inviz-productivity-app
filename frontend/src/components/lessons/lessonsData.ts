// ─── Lessons Data ─────────────────────────────────────────────────────────────
// Lesson content is created in the UI and stored in Firestore/Storage per user.
// This file holds the shared types and the built-in topic list used as defaults.

export interface LessonPage {
    /** Firebase Storage path — e.g. "lessons/english/similes/01_x.jpeg" */
    storagePath: string;
    /** Optional caption shown below the image */
    caption?: string;
    /** Source content for custom slides, allowing them to be edited after saving. */
    customSlide?: CustomSlideSettings;
}

export interface CustomSlideSettings {
    text: string;
    background: string;
    textColor: string;
    fontSize: number;
}

export interface Lesson {
    id: string;
    title: string;
    /** Short description shown in the library card */
    description?: string;
    /** Which topic group this lesson belongs to */
    topic: string;
    /** Ordered pages */
    pages: LessonPage[];
    /**
     * Optional explicit thumbnail Storage path.
     * Defaults to the first page's storagePath when omitted.
     */
    thumbnailPath?: string;
}

export interface LessonTopic {
    id: string;
    label: string;
    /** Tailwind background colour class for the topic card */
    color: string;
    /** Emoji / icon shown on the card */
    icon: string;
}

// ─── Topics ──────────────────────────────────────────────────────────────────
// Built-in topic choices shown in the create form; user-created lessons may
// introduce additional topic ids, which are displayed with a generic icon.
export const LESSON_TOPICS: LessonTopic[] = [
    { id: 'radicals',   label: 'Radicals',       color: 'bg-sky-500',      icon: '🔤' },
    { id: 'kanji',      label: 'Kanji',           color: 'bg-violet-600',   icon: '字' },
    { id: 'grammar',    label: 'Grammar',         color: 'bg-emerald-600',  icon: '📐' },
    { id: 'english', label: 'English',      color: 'bg-amber-500',    icon: '📖' },
    { id: 'math',    label: 'Math',         color: 'bg-rose-500',     icon: '➗' },
    { id: 'general',    label: 'General',         color: 'bg-slate-600',    icon: '📚' },
];
