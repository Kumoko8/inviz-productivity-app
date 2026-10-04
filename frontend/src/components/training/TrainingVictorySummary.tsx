import React, { useState } from "react";
import { TrainingCharacterState } from "./TrainingCharacterCard";
import { SubtopicLevel } from "../../utils/trainingUtils";

interface CharSummary {
    character: TrainingCharacterState;
    correct: number;
    total: number;
}

export type { CharSummary };

interface Props {
    summaries: CharSummary[];
    levelBonus: number;
    subtopicLevel: SubtopicLevel;
    isPartial?: boolean;
    isDefeat?: boolean;
    onAwardXP: (charId: string, xp: number) => void;
    onAwardAllAndReplay: (xpMap: Record<string, number>) => void;
    onLevelDown?: () => void;
    onLevelUp?: () => void;
    onChangeTopic?: () => void;
    onExit: () => void;
}

function calcXP(level: number, correct: number, total: number, levelBonus: number, conditionalMinimum = false): number {
    const accuracy = total > 0 ? correct / total : 0;
    if (conditionalMinimum && accuracy < 0.5) return 25;
    const base = Math.pow(level, 2) + (accuracy * 100);
    return Math.round(base + levelBonus);
}

const TrainingVictorySummary: React.FC<Props> = ({ summaries, levelBonus, subtopicLevel, isPartial, isDefeat, onAwardXP, onAwardAllAndReplay, onLevelDown, onLevelUp, onChangeTopic, onExit }) => {
    const conditionalXP = isPartial || isDefeat;
    const [awarded, setAwarded] = useState<Record<string, boolean>>({});

    const handleAward = (charId: string, xp: number) => {
        if (awarded[charId]) return;
        setAwarded(prev => ({ ...prev, [charId]: true }));
        onAwardXP(charId, xp);
    };

    const handlePlayAgain = () => {
        const xpMap: Record<string, number> = {};
        for (const { character, correct, total } of summaries) {
            if (!awarded[character.id]) {
                xpMap[character.id] = calcXP(character.level, correct, total, levelBonus);
            }
        }
        onAwardAllAndReplay(xpMap);
    };
    return (
        <div className="flex flex-col items-center gap-4 w-full">
            {isDefeat ? (
                <>
                    <div className="text-4xl">💀</div>
                    <div className="text-xl font-bold text-red-400">Defeated!</div>
                </>
            ) : isPartial ? (
                <div className="text-xl font-bold text-yellow-300">Session Summary</div>
            ) : (
                <>
                    <div className="text-4xl">🏆</div>
                    <div className="text-xl font-bold text-yellow-300">Victory!</div>
                </>
            )}

            <div className="flex flex-col gap-2 w-full">
                {summaries.map(({ character, correct, total }) => {
                    const xpEarned = calcXP(character.level, correct, total, levelBonus, conditionalXP);
                    const isAwarded = !!awarded[character.id];
                    return (
                        <button
                            key={character.id}
                            onClick={() => handleAward(character.id, xpEarned)}
                            disabled={isAwarded}
                            className={`flex items-center justify-between rounded-xl px-4 py-2 gap-3 w-full text-left border transition
                                ${isAwarded
                                    ? 'bg-sky-950 border-sky-600 cursor-default'
                                    : 'bg-purple-950 border-purple-700 hover:border-sky-400 hover:bg-purple-900 cursor-pointer'}
                            `}
                        >
                            {/* Name */}
                            <span className={`text-sm font-semibold truncate flex-1 ${isAwarded ? 'text-sky-300' : 'text-white'}`}>
                                {character.name}
                            </span>

                            {/* Score */}
                            <span className="text-purple-200 text-sm whitespace-nowrap">
                                {correct} / {total} correct
                            </span>

                            {/* XP earned / awarded */}
                            <span className={`text-sm font-bold whitespace-nowrap ${isAwarded ? 'text-sky-300' : 'text-sky-400'}`}>
                                {isAwarded ? `✓ +${xpEarned} XP awarded` : `+${xpEarned} XP`}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-3 pt-1 justify-center">
                {!isPartial && onLevelDown && (
                    <button
                        onClick={onLevelDown}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm"
                    >
                        ← Down a Level
                    </button>
                )}
                <button
                    onClick={handlePlayAgain}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition text-sm"
                >
                    {isDefeat ? "Try Again" : "Play Again"}
                </button>
                {!isPartial && onLevelUp && (
                    <button
                        onClick={onLevelUp}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition text-sm"
                    >
                        Up a Level →
                    </button>
                )}
                {onChangeTopic && (
                    <button
                        onClick={onChangeTopic}
                        className="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg transition text-sm"
                    >
                        Change Topic
                    </button>
                )}
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm"
                >
                    Exit
                </button>
            </div>
        </div>
    );
};

export default TrainingVictorySummary;
export { calcXP };
