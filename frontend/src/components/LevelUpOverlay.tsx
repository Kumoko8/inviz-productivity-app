import React, { useEffect } from 'react';

interface Props {
    message?: string;
    show: boolean;
    onDone?: () => void;
    className?: string;
    bubbleTopClass?: string;
    dotsTopClass?: string;
}

const LevelUpOverlay: React.FC<Props> = ({ message = 'Level Up!', show, onDone, className = '', bubbleTopClass = 'top-12', dotsTopClass = 'top-20' }) => {
    useEffect(() => {
        if (!show) return;
        const t = setTimeout(() => { onDone?.(); }, 1400);
        return () => clearTimeout(t);
    }, [show, onDone]);

    if (!show) return null;

    return (
        <div className={`absolute inset-0 flex items-start justify-center pointer-events-none ${className}`} aria-hidden>
            <div className={`absolute left-1/2 transform -translate-x-1/2 ${bubbleTopClass} pointer-events-none`}>
                <div className="speech-bubble">{message}</div>
            </div>

            <div className={`absolute left-1/2 transform -translate-x-1/2 ${dotsTopClass} pointer-events-none`}>
                <div className="relative w-28 h-8">
                    {[
                        [-24, '#FF6B6B'],
                        [-12, '#FFD93D'],
                        [0, '#6BCB77'],
                        [12, '#4D96FF'],
                        [24, '#C77DFF'],
                    ].map(([offset, color], i) => (
                        <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) translateX(${offset}px)` }}>
                            <span className="dot dot-anim" style={{ background: String(color), animationDelay: `${(i as number) * 140}ms` }} />
                        </div>
                    ))}
                </div>
            </div>

            <style>{`@keyframes dot-pop { 0% { transform: translateY(0) scale(1); opacity: 1 } 60% { transform: translateY(-18px) scale(1.2); opacity: 1 } 100% { transform: translateY(-34px) scale(0.6); opacity: 0 } }
      .dot { display:block; width:8px; height:8px; border-radius:9999px; }
      .dot-anim { display:block; animation: dot-pop 1400ms cubic-bezier(.2,.8,.2,1) forwards; }
      .speech-bubble { position: relative; display: inline-block; background: white; color: black; padding: 6px 10px; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 6px 18px rgba(0,0,0,0.08); font-size: 13px; font-weight: 600; animation: speech-bounce 420ms ease-in-out 0s 3; }
      .speech-bubble::after { content: ''; position: absolute; width: 10px; height: 10px; background: white; border-left: 1px solid #e5e7eb; transform: rotate(45deg); bottom: -5px; left: 50%; margin-left: -5px; }
      @keyframes speech-bounce { 0% { transform: translateY(0); } 25% { transform: translateY(-8px); } 50% { transform: translateY(0); } 75% { transform: translateY(-4px); } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>
        </div>
    );
};

export default LevelUpOverlay;
