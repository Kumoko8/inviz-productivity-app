import React, { useState, useCallback, useRef, useEffect } from "react";
import { fetchAnimUrl } from "../../utils/storageUtils";
import TrainingDifficultyModal, { DifficultySelection } from "./TrainingDifficultyModal";
import { CharacterOption } from "./TrainingCharacterSelect";
import TrainingOpponent from "./TrainingOpponent";
import TrainingQuestion from "./TrainingQuestion";
import TrainingCharacterCard, { TrainingCharacterState } from "./TrainingCharacterCard";
import TrainingVictorySummary, { CharSummary } from "./TrainingVictorySummary";
import { generateQuestion, pickWeightedCustomQuestion, Question, QuestionHistory, Subtopic, SubtopicLevel, SUBTOPIC_LABELS, SUBTOPIC_TO_TOPIC, SUBTOPIC_LEVEL_BONUS } from "../../utils/trainingUtils";
import { addTrainingSession } from "../../services/trainingDataService";
import { CustomTrainingSeries } from "../../types/customTraining";
import { xpThreshold } from "../../utils/xpUtils";
import { TrainingQuestionEntry } from "../../types/trainingData";
import StoryReader from "../puzzle/reading/StoryReader";
import EquationsGame from "../puzzle/math/EquationsGame";

const OPPONENT_MAX_HP = 100;

// XP bonus curve for custom training series (no static SUBTOPIC_LEVEL_BONUS entry exists for these)
const CUSTOM_LEVEL_BONUS: Record<SubtopicLevel, number> = { 1: 0, 2: 50, 3: 100 };

// Per-character resolved animation URLs — stored in a ref to avoid triggering renders
type AnimSet = { idle?: string; wounded?: string; action?: string; damage?: string; defeat?: string };
const OPPONENT_DAMAGE = 10;  // damage dealt to opponent per correct answer
const CHARACTER_DAMAGE = 10; // damage dealt to characters per wrong answer

// Maps subtopic level to opponent name
const OPPONENT_BY_LEVEL: Record<SubtopicLevel, string> = {
    1: 'redBlob',
    2: 'cricket',
    3: 'bacteria',
};

// Returns Firebase Storage paths for a named opponent.
// Upload files to: characters/opponent/<name>/idle/, .../action/, .../damage/
const getOpponentAnimPaths = (name: string) => ({
    idle: `characters/opponent/${name}/idle/${name}_idle.mp4`,
    action: `characters/opponent/${name}/action/${name}_action.mp4`,
    damage: `characters/opponent/${name}/damage/${name}_damage.mp4`,
});

interface Props {
    uid?: string | null;
    allCharacters: CharacterOption[];
    onAwardXP: (charId: string, xp: number) => void; onSetHp?: (charId: string, hp: number) => void; onNavigateToCharacter?: (charId: string) => void;
    onClose: () => void;
}

type Phase = "difficulty" | "battle" | "victory" | "ended" | "defeat" | "story_reader" | "equations";

const ACTION_ANIM_MS = 1600;
const DAMAGE_ANIM_MS = 1600;

const TrainingMode: React.FC<Props> = ({ uid, allCharacters, onAwardXP, onSetHp, onNavigateToCharacter, onClose }) => {
    const [phase, setPhase] = useState<Phase>("difficulty");
    const [difficulty, setDifficulty] = useState<Subtopic | null>(null);
    const [customSeries, setCustomSeries] = useState<CustomTrainingSeries | null>(null);
    const [subtopicLevel, setSubtopicLevel] = useState<SubtopicLevel | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [score, setScore] = useState({ correct: 0, wrong: 0 });
    // Per-character answer tracking: { [charId]: { correct, total } }
    const [charScores, setCharScores] = useState<Record<string, { correct: number; total: number }>>({})

    const [opponentHp, setOpponentHp] = useState(OPPONENT_MAX_HP);
    const [opponentHurt, setOpponentHurt] = useState(false);
    const [opponentActing, setOpponentActing] = useState(false);
    const [opponentName, setOpponentName] = useState<string>('default');
    const [opponentAnimUrls, setOpponentAnimUrls] = useState<{ idle?: string; action?: string; damage?: string }>({});
    const [showTopicPicker, setShowTopicPicker] = useState(false);
    const [storyReaderChars, setStoryReaderChars] = useState<CharacterOption[]>([]);
    const [equationsChars, setEquationsChars] = useState<CharacterOption[]>([]);

    const [charStates, setCharStates] = useState<Record<string, TrainingCharacterState>>({});
    const [levelUpToast, setLevelUpToast] = useState<Record<string, boolean>>({});
    const [transformReadyList, setTransformReadyList] = useState<string[]>([]);
    const [skippedTransformIds, setSkippedTransformIds] = useState<string[]>([]);

    // Stores original CharacterOption data for transform threshold lookups
    const charOptionsRef = useRef<Record<string, CharacterOption>>({});
    // Stores all resolved animation URLs per character for instant swapping
    const resolvedAnimsRef = useRef<Record<string, AnimSet>>({});

    // Helper: returns the "resting" animation URL for a character given its current HP
    const getCurrentUrl = (id: string, hp: number, maxHp: number): string | undefined => {
        const a = resolvedAnimsRef.current[id];
        if (!a) return undefined;
        if (hp <= 0) return a.defeat ?? a.idle;
        if (hp <= maxHp * 0.5) return a.wounded ?? a.idle;
        return a.idle;
    };

    const hurtTimers = useRef<{ opp?: number; chars?: number }>({});
    // Per-character question log for session persistence
    const questionLogRef = useRef<Record<string, TrainingQuestionEntry[]>>({});
    // Session-level question outcome history used to bias the next draw
    const questionHistoryRef = useRef<QuestionHistory>({});
    // Ref to the current question so handlers can log without stale closure
    const questionRef = useRef<Question | null>(null);
    // Guard to only save sessions once per battle
    const sessionSavedRef = useRef(false);

    // --- Init helpers ---

    // Keep questionRef in sync so answer handlers always see the current question
    useEffect(() => { questionRef.current = question; }, [question]);

    const initCharStates = useCallback((chars: CharacterOption[]) => {
        const map: Record<string, TrainingCharacterState> = {};
        for (const c of chars) {
            map[c.id] = {
                id: c.id,
                name: c.name,
                hp: c.hp,
                maxHp: c.maxHp,
                xp: c.xp ?? 0,
                level: c.level ?? 1,
                animUrl: c.animUrl,
            };
        }
        return map;
    }, []);

    // --- Difficulty selected -> start battle ---

    // Shared battle setup (opponent, anim resolution, char states) once the subtopic/level differ by mode
    const setupBattleCommon = async (level: SubtopicLevel, chars: CharacterOption[]) => {
        setSubtopicLevel(level);
        setOpponentHp(OPPONENT_MAX_HP);
        setScore({ correct: 0, wrong: 0 });
        setCharScores({});
        setTransformReadyList([]);
        setSkippedTransformIds([]);
        setPhase("battle");
        // Reset per-session tracking
        questionLogRef.current = {};
        sessionSavedRef.current = false;

        const resolvedOpponent = OPPONENT_BY_LEVEL[level];
        setOpponentName(resolvedOpponent);

        // Store original options for threshold lookups
        const optMap: Record<string, CharacterOption> = {};
        for (const c of chars) optMap[c.id] = c;
        charOptionsRef.current = optMap;
        // Clear previous resolved anim URLs
        resolvedAnimsRef.current = {};

        // Seed char states immediately (no animUrl yet for unloaded chars)
        const initial = initCharStates(chars);
        setCharStates(initial);

        // Resolve opponent animations
        setOpponentAnimUrls({});
        const oppPaths = getOpponentAnimPaths(resolvedOpponent);
        const [oppIdle, oppAction, oppDamage] = await Promise.all([
            fetchAnimUrl(oppPaths.idle),
            fetchAnimUrl(oppPaths.action),
            fetchAnimUrl(oppPaths.damage),
        ]);
        setOpponentAnimUrls({ idle: oppIdle || undefined, action: oppAction || undefined, damage: oppDamage || undefined });

        // Resolve all animation URLs per character (idle first, then the rest in parallel)
        for (const c of chars) {
            const entry: AnimSet = {};
            // Idle
            if (c.animUrl) {
                entry.idle = c.animUrl;
            } else if (c.animPath) {
                const url = await fetchAnimUrl(c.animPath);
                entry.idle = url || undefined;
            }
            // Action / damage / defeat / wounded in parallel
            const [actionUrl, damageUrl, defeatUrl, woundedUrl] = await Promise.all([
                c.actionAnimPath ? fetchAnimUrl(c.actionAnimPath).catch(() => '') : Promise.resolve(''),
                c.damageAnimPath ? fetchAnimUrl(c.damageAnimPath).catch(() => '') : Promise.resolve(''),
                c.defeatAnimPath ? fetchAnimUrl(c.defeatAnimPath).catch(() => '') : Promise.resolve(''),
                c.woundedAnimPath ? fetchAnimUrl(c.woundedAnimPath).catch(() => '') : Promise.resolve(''),
            ]);
            if (actionUrl) entry.action = actionUrl;
            if (damageUrl) entry.damage = damageUrl;
            if (defeatUrl) entry.defeat = defeatUrl;
            if (woundedUrl) entry.wounded = woundedUrl;
            resolvedAnimsRef.current[c.id] = entry;
            // Patch active URL + full set into charState so the card mounts all videos simultaneously
            setCharStates(prev => prev[c.id]
                ? { ...prev, [c.id]: { ...prev[c.id], animUrl: entry.idle, allAnimUrls: entry } }
                : prev
            );
        }
    };

    const handleDifficultySelect = async (d: Subtopic, level: SubtopicLevel, chars: CharacterOption[]) => {
        if (d === 'story_reader') {
            setStoryReaderChars(chars);
            const srOptMap: Record<string, CharacterOption> = {};
            for (const c of chars) srOptMap[c.id] = c;
            charOptionsRef.current = srOptMap;
            setCharStates(initCharStates(chars));
            setPhase('story_reader');
            return;
        }
        if (d === 'equations') {
            setEquationsChars(chars);
            const eqOptMap: Record<string, CharacterOption> = {};
            for (const c of chars) eqOptMap[c.id] = c;
            charOptionsRef.current = eqOptMap;
            setCharStates(initCharStates(chars));
            setPhase('equations');
            return;
        }
        setDifficulty(d);
        setCustomSeries(null);
        questionHistoryRef.current = {};
        setQuestion(generateQuestion(d, level, questionHistoryRef.current));
        await setupBattleCommon(level, chars);
    };

    const handleCustomDifficultySelect = async (series: CustomTrainingSeries, level: SubtopicLevel, chars: CharacterOption[]) => {
        setDifficulty(null);
        setCustomSeries(series);
        questionHistoryRef.current = {};
        setQuestion(pickWeightedCustomQuestion(series.questions[level], questionHistoryRef.current));
        await setupBattleCommon(level, chars);
    };

    const handlePickDifficulty = (selection: DifficultySelection, chars: CharacterOption[]) => {
        if (selection.kind === "custom") {
            handleCustomDifficultySelect(selection.series, selection.level, chars);
        } else {
            handleDifficultySelect(selection.subtopic, selection.level, chars);
        }
    };

    // --- Answer handlers ---

    const flashOpponentHurt = () => {
        if (hurtTimers.current.opp) window.clearTimeout(hurtTimers.current.opp);
        setOpponentHurt(true);
        hurtTimers.current.opp = window.setTimeout(() => setOpponentHurt(false), DAMAGE_ANIM_MS) as unknown as number;
    };

    const flashOpponentActing = () => {
        setOpponentActing(true);
        window.setTimeout(() => setOpponentActing(false), ACTION_ANIM_MS);
    };

    const handleCorrect = (charId: string, userAnswer: string) => {
        setScore(s => ({ ...s, correct: s.correct + 1 }));
        setCharScores(prev => {
            const cur = prev[charId] ?? { correct: 0, total: 0 };
            return { ...prev, [charId]: { correct: cur.correct + 1, total: cur.total + 1 } };
        });
        // Log question entry
        const q = questionRef.current;
        if (q) {
            const stats = questionHistoryRef.current[q.display] ?? { correct: 0, incorrect: 0 };
            questionHistoryRef.current[q.display] = { ...stats, correct: stats.correct + 1 };
            const correctAnswer = Array.isArray(q.answer) ? q.answer[0] : String(q.answer);
            const entry: TrainingQuestionEntry = { question: q.display, correctAnswer, userAnswer, correct: true };
            questionLogRef.current[charId] = [...(questionLogRef.current[charId] ?? []), entry];
        }
        flashOpponentHurt();
        // Switch character to its action animation. It plays as a one-shot to the
        // end of the video (see handleActionAnimEnd), never on a fixed timer.
        const actionUrl = resolvedAnimsRef.current[charId]?.action;
        if (actionUrl) {
            setCharStates(prev => prev[charId] ? { ...prev, [charId]: { ...prev[charId], animUrl: actionUrl } } : prev);
        }
        const newHp = Math.max(0, opponentHp - OPPONENT_DAMAGE);
        setOpponentHp(newHp);
        if (newHp <= 0) setPhase("victory");
    };

    // Called by TrainingCharacterCard once the action video has actually finished playing
    const handleActionAnimEnd = (charId: string) => {
        setCharStates(prev => {
            if (!prev[charId]) return prev;
            const cs = prev[charId];
            return { ...prev, [charId]: { ...cs, animUrl: getCurrentUrl(charId, cs.hp, cs.maxHp) } };
        });
    };

    const handleWrong = (charId: string, userAnswer: string) => {
        setScore(s => ({ ...s, wrong: s.wrong + 1 }));
        setCharScores(prev => {
            const cur = prev[charId] ?? { correct: 0, total: 0 };
            return { ...prev, [charId]: { correct: cur.correct, total: cur.total + 1 } };
        });
        // Log question entry
        const q = questionRef.current;
        if (q) {
            const stats = questionHistoryRef.current[q.display] ?? { correct: 0, incorrect: 0 };
            questionHistoryRef.current[q.display] = { ...stats, incorrect: stats.incorrect + 1 };
            const correctAnswer = Array.isArray(q.answer) ? q.answer[0] : String(q.answer);
            const entry: TrainingQuestionEntry = { question: q.display, correctAnswer, userAnswer, correct: false };
            questionLogRef.current[charId] = [...(questionLogRef.current[charId] ?? []), entry];
        }
        flashOpponentActing();
        // Compute new HP from charOptionsRef (kept in sync) so we can persist + update the ref outside setCharStates
        const curHp = charOptionsRef.current[charId]?.hp ?? 100;
        const maxHp = charOptionsRef.current[charId]?.maxHp ?? 100;
        const newHp = Math.max(0, curHp - CHARACTER_DAMAGE);
        // Keep ref in sync so handleQuickRestart seeds correct HP
        if (charOptionsRef.current[charId]) {
            charOptionsRef.current[charId] = { ...charOptionsRef.current[charId], hp: newHp };
        }
        // Persist HP to Firestore via parent
        onSetHp?.(charId, newHp);
        // Update HP and swap animation URL: damage flash → restore to defeat/wounded/idle after 400ms
        if (hurtTimers.current.chars) window.clearTimeout(hurtTimers.current.chars);
        const isNowDefeated = newHp <= 0;
        const anims = resolvedAnimsRef.current[charId];
        const restoreUrl = isNowDefeated
            ? (anims?.defeat ?? anims?.idle)
            : newHp <= maxHp * 0.5
                ? (anims?.wounded ?? anims?.idle)
                : anims?.idle;
        const damageUrl = anims?.damage;
        hurtTimers.current.chars = window.setTimeout(() => {
            setCharStates(p => p[charId] ? { ...p, [charId]: { ...p[charId], animUrl: restoreUrl } } : p);
        }, DAMAGE_ANIM_MS) as unknown as number;
        setCharStates(prev => {
            if (!prev[charId]) return prev;
            const next = { ...prev, [charId]: { ...prev[charId], hp: newHp, animUrl: damageUrl ?? prev[charId].animUrl } };
            const allDead = Object.values(next).every(c => c.hp <= 0);
            if (allDead) setTimeout(() => setPhase("defeat"), 50);
            return next;
        });
    };

    const handleNext = () => {
        if (customSeries && subtopicLevel) {
            setQuestion(pickWeightedCustomQuestion(customSeries.questions[subtopicLevel], questionHistoryRef.current));
        } else if (difficulty && subtopicLevel) {
            setQuestion(generateQuestion(difficulty, subtopicLevel, questionHistoryRef.current));
        }
    };

    // --- Restart ---

    const handleRestart = () => {
        setPhase("difficulty");
        setDifficulty(null);
        setCustomSeries(null);
        setSubtopicLevel(null);
        setQuestion(null);
        setCharScores({});
        setLevelUpToast({});
        setTransformReadyList([]);
        setSkippedTransformIds([]);
        questionLogRef.current = {};
        sessionSavedRef.current = false;
    };

    // Quick-restart at a specific subtopic+level using the same character options (no picker)
    const handleQuickRestart = (subtopic: Subtopic, level: SubtopicLevel) => {
        const chars = Object.values(charOptionsRef.current);
        setCharScores({});
        setLevelUpToast({});
        setTransformReadyList([]);
        setSkippedTransformIds([]);
        questionLogRef.current = {};
        questionHistoryRef.current = {};
        sessionSavedRef.current = false;
        handleDifficultySelect(subtopic, level, chars);
    };

    // Quick-restart at a specific custom series+level using the same character options (no picker)
    const handleQuickRestartCustom = (series: CustomTrainingSeries, level: SubtopicLevel) => {
        const chars = Object.values(charOptionsRef.current);
        setCharScores({});
        setLevelUpToast({});
        setTransformReadyList([]);
        setSkippedTransformIds([]);
        questionLogRef.current = {};
        questionHistoryRef.current = {};
        sessionSavedRef.current = false;
        handleCustomDifficultySelect(series, level, chars);
    };

    // Award all un-awarded XP then quick-restart at the same level
    const handleAwardAllAndReplay = (xpMap: Record<string, number>) => {
        for (const [charId, xp] of Object.entries(xpMap)) {
            handleAwardXP(charId, xp);
        }
        // slight delay so XP state settles before reset
        if (customSeries && subtopicLevel) {
            setTimeout(() => handleQuickRestartCustom(customSeries, subtopicLevel), 50);
        } else if (difficulty && subtopicLevel) {
            setTimeout(() => handleQuickRestart(difficulty, subtopicLevel), 50);
        }
    };

    // Save training sessions for all characters when a victory or early-end is recorded
    useEffect(() => {
        if (phase !== "victory" && phase !== "ended" && phase !== "defeat") return;
        if (sessionSavedRef.current) return;
        if (!uid || (!difficulty && !customSeries) || !subtopicLevel) return;
        sessionSavedRef.current = true;
        const now = Date.now();
        const topic = customSeries ? customSeries.topicName : (SUBTOPIC_TO_TOPIC[difficulty!] ?? difficulty!);
        const subtopicValue = customSeries ? customSeries.subtopicName : difficulty!;
        for (const cs of Object.values(charStates)) {
            const scores = charScores[cs.id] ?? { correct: 0, total: 0 };
            const entries = questionLogRef.current[cs.id] ?? [];
            const pct = scores.total > 0 ? Math.round((scores.correct / scores.total) * 100) : 0;
            addTrainingSession(uid, cs.id, {
                date: now,
                topic,
                subtopic: subtopicValue,
                level: subtopicLevel,
                correct: scores.correct,
                total: scores.total,
                pct,
                charName: cs.name,
                entries,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);


    // --- Award XP: update charStates immediately for visual feedback, then persist ---

    const handleAwardXP = (charId: string, xp: number) => {
        onAwardXP(charId, xp);
        setCharStates(prev => {
            if (!prev[charId]) return prev;
            const cs = prev[charId];
            let newXp = cs.xp + xp;
            let newLevel = cs.level;
            while (newXp >= xpThreshold(newLevel)) {
                newXp -= xpThreshold(newLevel);
                newLevel++;
            }
            if (newLevel > cs.level) {
                setLevelUpToast(t => ({ ...t, [charId]: true }));
                // Check transform threshold
                const opt = charOptionsRef.current[charId];
                const thresholds = opt?.transformThresholds ?? [];
                const tIdx = opt?.transformIndex ?? 0;
                const nextThreshold = thresholds[tIdx];
                if (
                    typeof nextThreshold === 'number' &&
                    newLevel >= nextThreshold &&
                    !skippedTransformIds.includes(charId)
                ) {
                    setTransformReadyList(t => t.includes(charId) ? t : [...t, charId]);
                }
            }
            // Keep charOptionsRef in sync so handleQuickRestart seeds the next battle with current xp/level
            if (charOptionsRef.current[charId]) {
                charOptionsRef.current[charId] = { ...charOptionsRef.current[charId], xp: newXp, level: newLevel };
            }
            return { ...prev, [charId]: { ...cs, xp: newXp, level: newLevel } };
        });
    };

    // --- Render ---

    const activeLabel = customSeries ? customSeries.subtopicName : (difficulty ? SUBTOPIC_LABELS[difficulty] : "");
    const activeLevelBonus = subtopicLevel == null ? 0 : (customSeries ? CUSTOM_LEVEL_BONUS[subtopicLevel] : (difficulty ? SUBTOPIC_LEVEL_BONUS[difficulty][subtopicLevel] : 0));
    const handleLevelDown = () => {
        if (!subtopicLevel) return;
        if (customSeries) handleQuickRestartCustom(customSeries, (subtopicLevel - 1) as SubtopicLevel);
        else if (difficulty) handleQuickRestart(difficulty, (subtopicLevel - 1) as SubtopicLevel);
    };
    const handleLevelUp = () => {
        if (!subtopicLevel) return;
        if (customSeries) handleQuickRestartCustom(customSeries, (subtopicLevel + 1) as SubtopicLevel);
        else if (difficulty) handleQuickRestart(difficulty, (subtopicLevel + 1) as SubtopicLevel);
    };

    return (
        <>
            {/* Difficulty picker */}
            {phase === "difficulty" && (
                <TrainingDifficultyModal uid={uid} allCharacters={allCharacters} onSelect={handlePickDifficulty} onCancel={onClose} />
            )}

            {/* Story Reader standalone phase */}
            {phase === "story_reader" && (
                <StoryReader
                    characters={storyReaderChars.map(c => ({
                        id: c.id, name: c.name, hp: c.hp, maxHp: c.maxHp, xp: c.xp ?? 0, level: c.level ?? 1,
                    }))}
                    onResultsReady={(correct, total, storyLevel, entries) => {
                        if (!uid) return;
                        const now = Date.now();
                        const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                        for (const c of storyReaderChars) {
                            addTrainingSession(uid, c.id, {
                                date: now,
                                topic: 'Reading',
                                subtopic: 'story_reader',
                                level: storyLevel,
                                correct,
                                total,
                                pct,
                                charName: c.name,
                                entries,
                            });
                        }
                    }}
                    onClaimXP={(correct, total, storyLevel) => {
                        for (const c of storyReaderChars) {
                            const charLevel = c.level ?? 1;
                            const accuracy = total > 0 ? correct / total : 0;
                            const xp = Math.round(Math.pow(charLevel, 2) + (accuracy * 100) + SUBTOPIC_LEVEL_BONUS['story_reader'][storyLevel]);
                            handleAwardXP(c.id, xp);
                        }
                    }}
                    onClose={() => setPhase("difficulty")}
                />
            )}

            {/* Equations standalone phase */}
            {phase === "equations" && (
                <EquationsGame
                    characters={equationsChars.map(c => ({
                        id: c.id, name: c.name, hp: c.hp, maxHp: c.maxHp, xp: c.xp ?? 0, level: c.level ?? 1,
                    }))}
                    onComplete={(completed, equationsLevel) => {
                        for (const c of equationsChars) {
                            const charLevel = c.level ?? 1;
                            const xp = Math.round(Math.pow(charLevel, 2) + completed * 25 + SUBTOPIC_LEVEL_BONUS['equations'][equationsLevel]);
                            handleAwardXP(c.id, xp);
                        }
                    }}
                    onClose={() => setPhase("difficulty")}
                />
            )}

            {/* Battle screen */}
            {(phase === "battle" || phase === "victory" || phase === "ended" || phase === "defeat") && (
                <div className="fixed inset-0 bg-gray-950 z-[70] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-purple-950 border-b border-purple-700">
                        <h2 className="text-white font-bold text-lg">
                            Training Mode
                            <span className="ml-2 text-xs font-normal text-purple-300">
                                {activeLabel ? `— ${activeLabel} Lv ${subtopicLevel}` : ""}
                            </span>
                        </h2>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-green-400 font-semibold">✓ {score.correct}</span>
                            <span className="text-red-400 font-semibold">✗ {score.wrong}</span>
                            {phase === "battle" && (
                                <button
                                    onClick={() => setPhase("ended")}
                                    className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold rounded transition text-sm"
                                >
                                    End Training
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition text-sm ml-2"
                            >
                                Exit
                            </button>
                        </div>
                    </div>

                    {/* Battle area — stacked vertically on small screens, side-by-side on md+ */}
                    <div className="flex flex-col md:flex-row gap-4 px-4 py-4 overflow-y-auto overscroll-contain flex-1">

                        {/* Characters (LEFT on md+, TOP on small) */}
                        <div className="flex flex-col gap-3 md:flex-1 min-w-0">
                            {Object.values(charStates).map(cs => (
                                <TrainingCharacterCard
                                    key={cs.id}
                                    character={cs}
                                    question={question}
                                    showLevelUp={!!levelUpToast[cs.id]}
                                    onLevelUpDone={() => setLevelUpToast(t => ({ ...t, [cs.id]: false }))}
                                    onCorrect={handleCorrect}
                                    onWrong={handleWrong}
                                    onNext={handleNext}
                                    onActionAnimEnd={handleActionAnimEnd}
                                />
                            ))}
                        </div>

                        {/* RIGHT: opponent + question */}
                        <div className="flex-[2] flex flex-col gap-4 min-w-0">
                            {/* Opponent */}
                            <TrainingOpponent
                                hp={opponentHp}
                                maxHp={OPPONENT_MAX_HP}
                                isHurt={opponentHurt}
                                isActing={opponentActing}
                                idleAnimUrl={opponentAnimUrls.idle}
                                actionAnimUrl={opponentAnimUrls.action}
                                damageAnimUrl={opponentAnimUrls.damage}
                                name={opponentName}
                                level={subtopicLevel ?? undefined}
                            />

                            {/* Question / result panel */}
                            <div className="flex flex-col items-center gap-2 bg-purple-900 bg-opacity-60 rounded-2xl px-4 py-4 border border-purple-600">
                                {phase === "battle" && question && (
                                    <>
                                        <TrainingQuestion question={question} />
                                        <button
                                            onClick={handleNext}
                                            className="mt-1 px-4 py-1 text-xs text-purple-300 hover:text-white border border-purple-600 hover:border-purple-400 rounded-full transition"
                                        >
                                            Skip
                                        </button>
                                    </>
                                )}

                                {(phase === "victory" || phase === "ended") && (() => {
                                    const summaries: CharSummary[] = Object.values(charStates).map(cs => ({
                                        character: cs,
                                        correct: charScores[cs.id]?.correct ?? 0,
                                        total: charScores[cs.id]?.total ?? 0,
                                    }));
                                    return (
                                        <TrainingVictorySummary
                                            summaries={summaries}
                                            levelBonus={activeLevelBonus}
                                            subtopicLevel={subtopicLevel!}
                                            isPartial={phase === "ended"}
                                            onAwardXP={handleAwardXP}
                                            onAwardAllAndReplay={handleAwardAllAndReplay}
                                            onLevelDown={subtopicLevel! > 1 ? handleLevelDown : undefined}
                                            onLevelUp={subtopicLevel! < 3 ? handleLevelUp : undefined}
                                            onChangeTopic={() => setShowTopicPicker(true)}
                                            onExit={onClose}
                                        />
                                    );
                                })()}

                                {phase === "defeat" && (() => {
                                    const summaries: CharSummary[] = Object.values(charStates).map(cs => ({
                                        character: cs,
                                        correct: charScores[cs.id]?.correct ?? 0,
                                        total: charScores[cs.id]?.total ?? 0,
                                    }));
                                    return (
                                        <TrainingVictorySummary
                                            summaries={summaries}
                                            levelBonus={activeLevelBonus}
                                            subtopicLevel={subtopicLevel!}
                                            isDefeat
                                            onAwardXP={handleAwardXP}
                                            onAwardAllAndReplay={handleAwardAllAndReplay}
                                            onLevelDown={subtopicLevel! > 1 ? handleLevelDown : undefined}
                                            onLevelUp={subtopicLevel! < 3 ? handleLevelUp : undefined}
                                            onChangeTopic={() => setShowTopicPicker(true)}
                                            onExit={onClose}
                                        />
                                    );
                                })()}
                            </div>
                        </div>

                    </div>

                    {/* Change-topic picker — shown over the victory/ended summary */}
                    {showTopicPicker && (
                        <TrainingDifficultyModal
                            uid={uid}
                            allCharacters={Object.values(charOptionsRef.current)}
                            skipCharacters
                            onSelect={(selection) => {
                                setShowTopicPicker(false);
                                if (selection.kind === "custom") {
                                    handleQuickRestartCustom(selection.series, selection.level);
                                } else {
                                    handleQuickRestart(selection.subtopic, selection.level);
                                }
                            }}
                            onCancel={() => setShowTopicPicker(false)}
                        />
                    )}

                    {/* Transform-ready notification */}
                    {transformReadyList.length > 0 && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-auto">
                            <div
                                className="absolute inset-0 bg-black bg-opacity-50"
                                onClick={() => {
                                    setSkippedTransformIds(prev => [...prev, ...transformReadyList]);
                                    setTransformReadyList([]);
                                }}
                            />
                            <div className="relative bg-gray-900 border border-purple-500 rounded-xl p-6 shadow-2xl z-10 max-w-sm w-full mx-4 text-center">
                                <div className="text-2xl mb-2">✨</div>
                                <h3 className="text-lg font-bold text-white mb-1">Transformation Ready!</h3>
                                <p className="text-sm text-purple-200 mb-4">
                                    {transformReadyList.length === 1
                                        ? "A character has reached a transformation level!"
                                        : "Characters have reached a transformation level!"}
                                    {" "}Visit their page to transform.
                                </p>
                                <div className="flex flex-col gap-2 max-h-48 overflow-auto mb-4">
                                    {transformReadyList.map(id => {
                                        const cs = charStates[id];
                                        const display = cs?.name ?? id;
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => {
                                                    onClose();
                                                    onNavigateToCharacter?.(id);
                                                }}
                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition"
                                            >
                                                Go to {display}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => {
                                        setSkippedTransformIds(prev => [...prev, ...transformReadyList]);
                                        setTransformReadyList([]);
                                    }}
                                    className="text-xs text-purple-400 hover:text-purple-200 underline"
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default TrainingMode;
