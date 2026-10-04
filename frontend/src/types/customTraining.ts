// User-authored training content (distinct from trainingData.ts, which logs session results)

export interface CustomQuestionItem {
    id: string;
    display: string;
    answers: string[];
}

export interface CustomTrainingSeries {
    id: string;
    topicName: string;
    subtopicName: string;
    createdAt: number;
    updatedAt: number;
    questions: {
        1: CustomQuestionItem[];
        2: CustomQuestionItem[];
        3: CustomQuestionItem[];
    };
}
