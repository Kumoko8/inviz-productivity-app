import React, { useEffect, useState } from 'react';
import usePixelSpriteFrames from '../../hooks/usePixelSpriteFrames';

type Props = {
    id: string;
    scale?: number;
    fps?: number;
    size?: number; // base sprite size in px before scaling; legacy sprites were drawn at 32x32
    className?: string;
};

// Generic replacement for the old hand-coded `*Pixel.tsx` components: instead of
// drawing frames on a canvas at runtime, this loads pre-rendered PNG frames from
// Firebase Storage (`pixelCharacters/{id}/frame_N.png`) and cycles through them.
const PixelSprite: React.FC<Props> = ({ id, scale = 6, fps = 6, size = 32, className }) => {
    const { frames, loading } = usePixelSpriteFrames(id);
    const [frameIndex, setFrameIndex] = useState(0);

    useEffect(() => {
        setFrameIndex(0);
        if (frames.length <= 1) return;
        const timer = window.setInterval(() => {
            setFrameIndex(prev => (prev + 1) % frames.length);
        }, 1000 / fps);
        return () => window.clearInterval(timer);
    }, [frames, fps]);

    const dimension = size * scale;

    return (
        <div
            className={className}
            style={{ width: dimension, height: dimension, imageRendering: 'pixelated', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            {frames.length > 0 ? (
                <img
                    src={frames[frameIndex]}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
                />
            ) : (
                <div style={{ width: '100%', height: '100%', background: loading ? 'rgba(0,0,0,0.05)' : 'transparent' }} />
            )}
        </div>
    );
};

export default PixelSprite;
