import React, { useEffect, useRef } from "react";

const OPPONENT_DISPLAY_NAMES: Record<string, string> = {
    redBlob: "Red Blob",
    cricket: "Cricket",
    bacteria: "Bacteria",
};

interface Props {
    hp: number;
    maxHp: number;
    isHurt: boolean;
    isActing?: boolean;
    idleAnimUrl?: string;
    actionAnimUrl?: string;
    damageAnimUrl?: string;
    name?: string;
    level?: number;
}

const TrainingOpponent: React.FC<Props> = ({
    hp, maxHp, isHurt, isActing = false,
    idleAnimUrl, actionAnimUrl, damageAnimUrl,
    name = "default", level,
}) => {
    const pct = Math.max(0, Math.round((hp / maxHp) * 100));
    const barColor =
        pct > 60 ? "bg-green-400" :
            pct > 30 ? "bg-yellow-400" :
                "bg-red-500";

    const displayName = OPPONENT_DISPLAY_NAMES[name] ?? name;

    // Pick video source based on current state; fall back gracefully
    const videoSrc = isHurt && damageAnimUrl ? damageAnimUrl
        : isActing && actionAnimUrl ? actionAnimUrl
            : idleAnimUrl;

    // All videos mounted simultaneously — only the active one plays; others are paused.
    const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
    const urlMap = { idle: idleAnimUrl, action: actionAnimUrl, damage: damageAnimUrl } as const;
    useEffect(() => {
        if (!videoSrc) return;
        for (const [key, url] of Object.entries(urlMap) as [string, string | undefined][]) {
            const v = videoRefs.current[key];
            if (!v || !url) continue;
            if (url === videoSrc) {
                v.currentTime = 0;
                v.play().catch(() => { });
            } else {
                v.pause();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoSrc]);

    return (
        <div className="flex flex-col items-center gap-3 w-full">
            {/* Opponent name + level badge */}
            <div className="flex items-center gap-2">
                <span className="text-purple-200 text-sm font-semibold uppercase tracking-widest">{displayName}</span>
                {level !== undefined && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-700 text-purple-100">
                        Lv {level}
                    </span>
                )}
            </div>

            {/* Animation frame */}
            <div
                className={`
                    w-full rounded-2xl flex items-center justify-center text-8xl
                    bg-purple-900 border-4 border-purple-400 shadow-lg select-none
                    transition-all duration-150 aspect-video overflow-hidden relative
                    ${isHurt ? "scale-[0.97] brightness-200 border-red-400" : ""}
                    ${isActing ? "scale-[1.02] brightness-125 border-yellow-400" : ""}
                    ${!isHurt && !isActing ? "scale-100" : ""}
                `}
                style={{ minHeight: "12rem" }}
            >
                {([['idle', idleAnimUrl], ['action', actionAnimUrl], ['damage', damageAnimUrl]] as [string, string | undefined][])
                    .filter((e): e is [string, string] => !!e[1])
                    .map(([key, url]) => (
                        <video
                            key={key}
                            ref={el => { videoRefs.current[key] = el; }}
                            src={url}
                            autoPlay loop muted playsInline
                            className="absolute inset-0 w-full h-full object-contain"
                            style={{ opacity: videoSrc === url ? 1 : 0 }}
                        />
                    ))
                }
                {!videoSrc && <span title="Opponent animation will appear here">👾</span>}
            </div>

            {/* HP bar */}
            <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-purple-200 mb-1">
                    <span>HP</span>
                    <span>{hp} / {maxHp}</span>
                </div>
                <div className="h-3 rounded-full bg-purple-950 overflow-hidden border border-purple-700">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default TrainingOpponent;
