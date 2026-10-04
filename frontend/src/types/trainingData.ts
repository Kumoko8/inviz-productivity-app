export interface TrainingQuestionEntry {
    question: string;
    correctAnswer: string;
    userAnswer: string;
    correct: boolean;
}

export interface TrainingSession {
    id?: string;
    date: number;          // Unix ms timestamp
    topic: string;         // e.g. "Math"
    subtopic: string;      // e.g. "addition"
    level: number;         // 1 | 2 | 3
    correct: number;
    total: number;
    pct: number;           // 0-100
    charName: string;
    entries: TrainingQuestionEntry[];
}

export interface PuzzleSession {
    id?: string;
    date: number;           // Unix ms timestamp
    puzzleType: string;     // e.g. "Nonogram"
    label: string;          // e.g. "5×5"
    level: number;          // 1 | 2 | 3
    elapsedSeconds: number;
    goalSeconds: number | null;
    solved: boolean;
    xpAwarded: number;
    charName: string;
}
