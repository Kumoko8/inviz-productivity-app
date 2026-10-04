import React, { useEffect, useRef } from 'react';
import { TrainingCharacterState } from '../training/TrainingCharacterCard';
import { xpThreshold } from '../../utils/xpUtils';

interface Props {
    character: TrainingCharacterState;
}

const PuzzleCharacterCard: React.FC<Props> = ({ character }) => {
    const { name, hp, maxHp, xp, level, animUrl } = character;
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => { });
        }
    }, [animUrl]);

    const hpPct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));
    const xpNeeded = xpThreshold(level);
    const xpPct = Math.max(0, Math.min(100, Math.round((xp / Math.max(1, xpNeeded)) * 100)));
    const hpColor = hpPct > 60 ? 'bg-green-400' : hpPct > 30 ? 'bg-yellow-400' : 'bg-red-500';

    return (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-fuchsia-700 bg-gray-900 w-full">
            {/* Animation frame */}
            <div className="w-full rounded-lg overflow-hidden bg-gray-800 border border-fuchsia-900 aspect-[4/3] flex items-center justify-center">
                {animUrl ? (
                    <video
                        ref={videoRef}
                        src={animUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <span className="text-4xl select-none">🧙</span>
                )}
            </div>

            {/* Name */}
            <span className="text-sm font-semibold text-white truncate">{name}</span>

            {/* HP bar */}
            <div>
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span>HP</span>
                    <span>{hp}/{maxHp}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${hpColor}`}
                        style={{ width: `${hpPct}%` }}
                    />
                </div>
            </div>

            {/* XP bar */}
            <div>
                <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span>Lv {level}</span>
                    <span>{xp}/{xpNeeded} XP</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${xpPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default PuzzleCharacterCard;
