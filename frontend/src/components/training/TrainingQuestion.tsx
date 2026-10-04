import React from "react";
import { Question } from "../../utils/trainingUtils";

interface Props {
    question: Question;
}

// Renders **bold** segments as <strong>, splitting on \n\n for multi-sentence word problems.
const renderInline = (text: string): React.ReactNode =>
    text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part));

const TrainingQuestion: React.FC<Props> = ({ question }) => {
    const fullText = question.display + (question.type === "math" ? " = ?" : "");
    const paragraphs = fullText.split('\n\n');
    return (
        <div className="flex items-center justify-center">
            <div className="text-3xl font-bold text-white tracking-wide drop-shadow text-center">
                {paragraphs.map((para, i) => (
                    <p key={i} className={i > 0 ? 'mt-4' : undefined}>{renderInline(para)}</p>
                ))}
            </div>
        </div>
    );
};

export default TrainingQuestion;
