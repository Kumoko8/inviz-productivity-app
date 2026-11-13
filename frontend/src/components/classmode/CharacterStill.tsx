import React, { useState } from 'react';
import { fetchAnimUrl } from '../../utils/storageUtils';

// Renders a character's animation paused on its first frame instead of autoplaying it.
// Used anywhere ClassMode shows a lightweight preview (base-character picker, selected
// character cards) so selecting many characters doesn't play many videos at once.
export const StillFrame: React.FC<{ url?: string; className?: string }> = ({
    url,
    className,
}) => {
    if (!url)
        return (
            <div
                className={`${className ?? 'w-full h-full'} flex items-center justify-center text-[10px] text-gray-400`}
            >
                No preview
            </div>
        );
    return (
        <video
            src={url}
            muted
            playsInline
            preload="metadata"
            onLoadedData={(e) => {
                e.currentTarget.currentTime = 0.05;
            }}
            className={`${className ?? 'w-full h-full'} object-cover pointer-events-none`}
        />
    );
};

export type StillState = 'default' | 'earnXp' | 'loseHp' | 'wounded';
export type StillFrames = Partial<Record<StillState, string>>;
export const WOUNDED_HP = 50;

// Responsive still frame: shows the Storage image (path stored in the character's Firestore
// `stillFrames` map) for the current state, falling back to the default image, then the paused video.
export const ResponsiveStill: React.FC<{
    frames?: StillFrames;
    state: StillState;
    videoUrl?: string;
    className?: string;
    version?: number;
}> = ({ frames, state, videoUrl, className, version }) => {
    // URLs are keyed by Storage path and every state's image is resolved up front in parallel,
    // so switching states (e.g. losing HP) swaps instantly instead of waiting on a fetch.
    const [urls, setUrls] = useState<Record<string, string>>({});
    const pathsKey = Array.from(
        new Set(Object.values(frames ?? {}).filter(Boolean))
    )
        .sort()
        .join('|');
    React.useEffect(() => {
        let cancelled = false;
        if (version) setUrls({});
        pathsKey
            .split('|')
            .filter(Boolean)
            .forEach((path) => {
                fetchAnimUrl(path).then((url) => {
                    if (!cancelled && url)
                        setUrls((prev) =>
                            prev[path] === url ? prev : { ...prev, [path]: url }
                        );
                });
            });
        return () => {
            cancelled = true;
        };
    }, [pathsKey, version]);
    const path = frames?.[state] || frames?.default;
    const url =
        (path && urls[path]) ||
        (frames?.default ? urls[frames.default] : undefined);
    if (!url) return <StillFrame url={videoUrl} className={className} />;
    return (
        <img
            src={url}
            alt=""
            style={{ imageRendering: 'pixelated' }}
            className={`${className ?? 'w-full h-full'} object-contain pointer-events-none`}
        />
    );
};
