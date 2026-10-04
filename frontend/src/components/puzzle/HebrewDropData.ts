/**
 * HebrewDropData — Hardcoded Biblical Hebrew alphabet.
 * 22 standard letters + 5 final (sofit) forms = 27 tiles.
 * No nikkud (vowel points). No vocab is hardcoded here — all vocab comes from user Firestore data.
 */

export interface HebrewLetterDef {
    id: string;
    char: string;
    name: string;
    transliteration: string; // rough consonant transliteration
    isFinalForm: boolean;
    baseId?: string; // for final forms: ID of the corresponding base letter
    color: string;
    textColor: string;
    glow: string;
}

// ─── Color palette ────────────────────────────────────────────────────────────
// Warm parchment / ancient manuscript palette for standard letters.
// Finals are muted, darker versions of their base colour family.
type C = { color: string; textColor: string; glow: string };

const PALETTE: C[] = [
    { color: '#92400e', textColor: '#fef3c7', glow: '#d97706' }, // amber
    { color: '#1e3a8a', textColor: '#dbeafe', glow: '#3b82f6' }, // sapphire
    { color: '#064e3b', textColor: '#d1fae5', glow: '#10b981' }, // emerald
    { color: '#881337', textColor: '#ffe4e6', glow: '#f43f5e' }, // crimson
    { color: '#4c1d95', textColor: '#ede9fe', glow: '#8b5cf6' }, // violet
    { color: '#134e4a', textColor: '#ccfbf1', glow: '#14b8a6' }, // teal
];

const FINAL_PALETTE: C[] = [
    { color: '#78350f', textColor: '#fde68a', glow: '#b45309' }, // dark amber  (final-mem, final-qof area)
    { color: '#172554', textColor: '#bfdbfe', glow: '#1d4ed8' }, // dark blue   (final-nun)
    { color: '#022c22', textColor: '#a7f3d0', glow: '#059669' }, // dark emerald (final-tsadi)
    { color: '#3b0764', textColor: '#e9d5ff', glow: '#6d28d9' }, // dark violet (final-kaf, final-pe)
];

function p(idx: number): C { return PALETTE[idx % PALETTE.length]; }
function fp(idx: number): C { return FINAL_PALETTE[idx % FINAL_PALETTE.length]; }

// ─── The Aleph-Bet ────────────────────────────────────────────────────────────
export const HEBREW_ALPHABET: HebrewLetterDef[] = [
    // Standard 22 letters (traditional order)
    { id: 'aleph',   char: 'א', name: 'Aleph',   transliteration: 'ʾ',  isFinalForm: false, ...p(0) },
    { id: 'bet',     char: 'ב', name: 'Bet',     transliteration: 'b',  isFinalForm: false, ...p(1) },
    { id: 'gimel',   char: 'ג', name: 'Gimel',   transliteration: 'g',  isFinalForm: false, ...p(2) },
    { id: 'dalet',   char: 'ד', name: 'Dalet',   transliteration: 'd',  isFinalForm: false, ...p(3) },
    { id: 'he',      char: 'ה', name: 'He',      transliteration: 'h',  isFinalForm: false, ...p(4) },
    { id: 'vav',     char: 'ו', name: 'Vav',     transliteration: 'w',  isFinalForm: false, ...p(5) },
    { id: 'zayin',   char: 'ז', name: 'Zayin',   transliteration: 'z',  isFinalForm: false, ...p(0) },
    { id: 'het',     char: 'ח', name: 'Het',     transliteration: 'ḥ',  isFinalForm: false, ...p(1) },
    { id: 'tet',     char: 'ט', name: 'Tet',     transliteration: 'ṭ',  isFinalForm: false, ...p(2) },
    { id: 'yod',     char: 'י', name: 'Yod',     transliteration: 'y',  isFinalForm: false, ...p(3) },
    { id: 'kaf',     char: 'כ', name: 'Kaf',     transliteration: 'k',  isFinalForm: false, ...p(4) },
    { id: 'lamed',   char: 'ל', name: 'Lamed',   transliteration: 'l',  isFinalForm: false, ...p(5) },
    { id: 'mem',     char: 'מ', name: 'Mem',     transliteration: 'm',  isFinalForm: false, ...p(0) },
    { id: 'nun',     char: 'נ', name: 'Nun',     transliteration: 'n',  isFinalForm: false, ...p(1) },
    { id: 'samekh',  char: 'ס', name: 'Samekh',  transliteration: 's',  isFinalForm: false, ...p(2) },
    { id: 'ayin',    char: 'ע', name: 'Ayin',    transliteration: 'ʿ',  isFinalForm: false, ...p(3) },
    { id: 'pe',      char: 'פ', name: 'Pe',      transliteration: 'p',  isFinalForm: false, ...p(4) },
    { id: 'tsadi',   char: 'צ', name: 'Tsadi',   transliteration: 'ṣ',  isFinalForm: false, ...p(5) },
    { id: 'qof',     char: 'ק', name: 'Qof',     transliteration: 'q',  isFinalForm: false, ...p(0) },
    { id: 'resh',    char: 'ר', name: 'Resh',    transliteration: 'r',  isFinalForm: false, ...p(1) },
    { id: 'shin',    char: 'ש', name: 'Shin',    transliteration: 'š',  isFinalForm: false, ...p(2) },
    { id: 'tav',     char: 'ת', name: 'Tav',     transliteration: 't',  isFinalForm: false, ...p(3) },
    // Final (sofit) forms — only used at the end of a word
    { id: 'final-kaf',   char: 'ך', name: 'Final Kaf',   transliteration: 'k', isFinalForm: true, baseId: 'kaf',   ...fp(3) },
    { id: 'final-mem',   char: 'ם', name: 'Final Mem',   transliteration: 'm', isFinalForm: true, baseId: 'mem',   ...fp(0) },
    { id: 'final-nun',   char: 'ן', name: 'Final Nun',   transliteration: 'n', isFinalForm: true, baseId: 'nun',   ...fp(1) },
    { id: 'final-pe',    char: 'ף', name: 'Final Pe',    transliteration: 'p', isFinalForm: true, baseId: 'pe',    ...fp(3) },
    { id: 'final-tsadi', char: 'ץ', name: 'Final Tsadi', transliteration: 'ṣ', isFinalForm: true, baseId: 'tsadi', ...fp(2) },
];

// ─── Lookup maps ──────────────────────────────────────────────────────────────
export const LETTER_MAP: Record<string, HebrewLetterDef> = {};
for (const letter of HEBREW_ALPHABET) {
    LETTER_MAP[letter.id] = letter;
}

export const CHAR_TO_LETTER: Record<string, HebrewLetterDef> = {};
for (const letter of HEBREW_ALPHABET) {
    CHAR_TO_LETTER[letter.char] = letter;
}

export const STANDARD_LETTERS = HEBREW_ALPHABET.filter(l => !l.isFinalForm);
export const FINAL_LETTERS = HEBREW_ALPHABET.filter(l => l.isFinalForm);
