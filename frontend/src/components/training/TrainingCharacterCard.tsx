import React, { useState, useEffect, useRef } from "react";
import { Question } from "../../utils/trainingUtils";
import { xpThreshold } from "../../utils/xpUtils";
import LevelUpOverlay from "../LevelUpOverlay";

export interface TrainingCharacterState {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    xp: number;
    level: number;
    animUrl?: string;  // currently active animation URL
    // All resolved URLs — card mounts all simultaneously; opacity picks the visible one
    allAnimUrls?: { idle?: string; wounded?: string; action?: string; damage?: string; defeat?: string };
}

interface Props {
    character: TrainingCharacterState;
    question: Question | null;
    showLevelUp?: boolean;
    onLevelUpDone?: () => void;
    onCorrect: (id: string, userAnswer: string) => void;
    onWrong: (id: string, userAnswer: string) => void;
    onNext: () => void;
    // Fired once the action video has actually finished playing (not on a fixed timer)
    onActionAnimEnd?: (id: string) => void;
}

type FeedbackState = "idle" | "correct" | "wrong";

const TrainingCharacterCard: React.FC<Props> = ({ character, question, showLevelUp, onLevelUpDone, onCorrect, onWrong, onNext, onActionAnimEnd }) => {
    const { id, name, hp, maxHp, xp, level, animUrl, allAnimUrls } = character;
    const isDead = hp <= 0;
    // Latest hp/maxHp for use inside the video 'ended' handler, without forcing the
    // playback effect to re-run (and restart the currently playing video) on every HP change.
    const statsRef = useRef({ hp, maxHp });
    useEffect(() => { statsRef.current = { hp, maxHp }; }, [hp, maxHp]);
    const [input, setInput] = useState("");
    const [feedback, setFeedback] = useState<FeedbackState>("idle");
    // Local flash state for CSS effects (replaces isHurt/isActing flags that lived in parent state)
    const [flash, setFlash] = useState<'none' | 'hurt' | 'acting'>('none');
    const flashTimerRef = useRef<number | null>(null);
    const triggerFlash = (type: 'hurt' | 'acting') => {
        if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
        setFlash(type);
        flashTimerRef.current = window.setTimeout(
            () => setFlash('none'),
            type === 'acting' ? 800 : 400
        ) as unknown as number;
    };
    useEffect(() => () => { if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current); }, []);

    // All video elements stay mounted (no remount/load penalty).
    // Only the active one plays; inactive ones are paused.
    // idle and defeat loop continuously; action/damage/wounded play once then revert to idle.
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
    // localAnimUrl mirrors the animUrl prop but can be overridden locally when a
    // one-shot animation ends so we switch to idle before the parent timer fires.
    const [localAnimUrl, setLocalAnimUrl] = useState(animUrl);
    useEffect(() => { setLocalAnimUrl(animUrl); }, [animUrl]);

    useEffect(() => {
        if (!allAnimUrls || !localAnimUrl) return;
        const loopingKeys = new Set(['idle', 'defeat']);
        let cleanupEnded: (() => void) | null = null;

        for (const [key, url] of Object.entries(allAnimUrls) as [string, string | undefined][]) {
            const v = videoRefs.current[key];
            if (!v || !url) continue;
            v.loop = loopingKeys.has(key);
            if (url === localAnimUrl) {
                v.currentTime = 0;
                v.play().catch(() => { });
                // One-shot: play fully to the end (no early cutoff), then revert to the
                // resting animation matching the character's current HP.
                if (!loopingKeys.has(key)) {
                    const onEnded = () => {
                        const { hp: curHp, maxHp: curMaxHp } = statsRef.current;
                        const revertUrl = curHp <= 0
                            ? (allAnimUrls.defeat ?? allAnimUrls.idle)
                            : curHp <= curMaxHp * 0.5
                                ? (allAnimUrls.wounded ?? allAnimUrls.idle)
                                : allAnimUrls.idle;
                        if (revertUrl) setLocalAnimUrl(revertUrl);
                        if (key === 'action') onActionAnimEnd?.(id);
                    };
                    v.addEventListener('ended', onEnded);
                    cleanupEnded = () => v.removeEventListener('ended', onEnded);
                }
            } else {
                v.pause();
            }
        }
        return () => { if (cleanupEnded) cleanupEnded(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localAnimUrl, allAnimUrls]);

    // Reset input + feedback when question changes
    useEffect(() => {
        setInput("");
        setFeedback("idle");
    }, [question]);

    const pct = Math.max(0, Math.round((hp / maxHp) * 100));
    const barColor =
        pct > 60 ? "bg-green-400" :
            pct > 30 ? "bg-yellow-400" :
                "bg-red-500";

    const nextLevelXP = xpThreshold(level);
    const xpPct = Math.max(0, Math.min(100, Math.round((xp / Math.max(1, nextLevelXP)) * 100)));

    const normalizeAnswer = (value: string) => value.trim().toLowerCase().replace(/−/g, '-').replace(/\s+/g, '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!question || isDead || feedback !== "idle") return;
        const userAnswer = normalizeAnswer(input);
        if (!userAnswer) return;
        const acceptedAnswers = (Array.isArray(question.answer)
            ? question.answer
            : [String(question.answer)]).map(normalizeAnswer);
        if (acceptedAnswers.includes(userAnswer)) {
            setFeedback("correct");
            triggerFlash('acting');
            onCorrect(id, userAnswer);
            setTimeout(onNext, 600);
        } else {
            setFeedback("wrong");
            triggerFlash('hurt');
            onWrong(id, userAnswer);
        }
    };

    const borderClass = isDead ? "border-gray-600 opacity-50" :
        feedback === "correct" ? "border-green-400" :
            feedback === "wrong" ? "border-red-500" :
                "border-purple-500";

    return (
        <div className={`flex flex-col gap-2 p-3 rounded-xl border-2 bg-gray-900 w-full transition-all duration-150 ${borderClass}`}>
            {/* Character sprite */}
            <div
                className={`
                    w-full rounded-lg overflow-hidden flex items-center justify-center
                    aspect-[4/3] relative
                    bg-gray-800 border border-purple-700 select-none
                    transition-all duration-150
                    ${flash === 'hurt' ? "scale-[0.97] brightness-150 border-red-500" : ""}
                    ${flash === 'acting' ? "scale-[1.02] brightness-125 border-yellow-400" : ""}
                `}
            >
                {allAnimUrls
                    ? (Object.entries(allAnimUrls) as [string, string | undefined][])
                        .filter((e): e is [string, string] => !!e[1])
                        .map(([key, url]) => (
                            <video
                                key={key}
                                ref={el => { videoRefs.current[key] = el; }}
                                src={url}
                                muted playsInline
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ opacity: localAnimUrl === url ? 1 : 0 }}
                            />
                        ))
                    : animUrl
                        ? <video src={animUrl} autoPlay loop muted playsInline className="w-full h-full object-contain" />
                        : (
                            <span className="text-5xl">🧙</span>
                        )}
            </div>

            {/* Name + stats — relative anchor for level-up toast */}
            <div className="relative flex flex-col gap-2">
                <LevelUpOverlay show={!!showLevelUp} onDone={onLevelUpDone} className="z-10" bubbleTopClass="top-2" dotsTopClass="top-10" />
                {/* Name */}
                <span className="text-sm font-semibold text-white break-words leading-tight">
                    {name}
                </span>

                {/* HP bar */}
                <div className="w-full">
                    <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>HP</span>
                        <span>{hp}/{maxHp}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* XP bar */}
                <div className="w-full">
                    <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                        <span>Lv {level}</span>
                        <span>{xp}/{nextLevelXP} XP</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-sky-400 transition-all duration-500"
                            style={{ width: `${xpPct}%` }}
                        />
                    </div>
                </div>

                {/* Answer input + Action/Next submit */}
                <form onSubmit={handleSubmit} className="flex gap-1.5">
                    <input
                        type="text"
                        value={input}
                        onChange={e => { if (feedback === "idle") setInput(e.target.value); }}
                        disabled={isDead || feedback !== "idle"}
                        placeholder="Answer"
                        className={`flex-1 min-w-0 text-center text-sm font-bold border-2 rounded-lg px-2 py-1 outline-none bg-gray-800 text-white
                            focus:ring-2 focus:ring-purple-400
                            ${feedback === "correct" ? "border-green-400" : feedback === "wrong" ? "border-red-500" : "border-gray-600"}`}
                    />
                    {feedback === "wrong" ? (
                        <button
                            type="button"
                            onClick={onNext}
                            className="px-2 py-1 text-xs font-bold rounded-lg transition flex-shrink-0 bg-red-700 hover:bg-red-600 text-white"
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={isDead || !question || feedback !== "idle"}
                            className={`px-2 py-1 text-xs font-bold rounded-lg transition flex-shrink-0
                                ${isDead || feedback !== "idle" ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700 text-white"}`}
                        >
                            {feedback === "correct" ? "✓" : "Action"}
                        </button>
                    )}
                </form>

                {/* Per-card feedback */}
                {feedback !== "idle" && (
                    <div className={`text-xs font-semibold text-center ${feedback === "correct" ? "text-green-400" : "text-red-400"}`}>
                        {feedback === "correct" ? "✓ Correct!" : `✗ Ans: ${Array.isArray(question?.answer) ? question.answer[0] : question?.answer}`}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrainingCharacterCard;
