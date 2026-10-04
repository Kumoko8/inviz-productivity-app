import React, { useEffect, useState } from 'react';
import { PrayOrb, PrayOrbGroup } from './focusOrbUtils';

interface FocusOrbLayerProps {
    prayerOrbs: PrayOrb[];
    orbGroups?: PrayOrbGroup[];
    onToggleGroup?: (groupId: string) => void;
    collapsing?: { orbs: PrayOrb[]; x: number; y: number; color: string } | null;
    orbPopup: PrayOrb | null;
    setOrbPopup: (orb: PrayOrb | null) => void;
}

// Animates a loose orb getting sucked toward the group's landing spot: it
// stretches along the travel direction, blurs and fades as it shrinks in.
const VacuumOrb: React.FC<{ orb: PrayOrb; targetX: number; targetY: number }> = ({ orb, targetX, targetY }) => {
    const [sucked, setSucked] = useState(false);
    useEffect(() => {
        const raf = requestAnimationFrame(() => setSucked(true));
        return () => cancelAnimationFrame(raf);
    }, []);

    const angle = Math.atan2(targetY - orb.y, targetX - orb.x) * (180 / Math.PI);

    return (
        <div
            className="absolute rounded-full pointer-events-none"
            style={{
                left: `${sucked ? targetX : orb.x}%`,
                top: `${sucked ? targetY : orb.y}%`,
                width: '0.85em',
                height: '0.85em',
                fontSize: '1rem',
                background: `radial-gradient(circle, white 0%, ${orb.color} 55%, ${orb.color}99 100%)`,
                boxShadow: `0 0 5px 2px ${orb.color}88, 0 0 14px 4px ${orb.color}44`,
                opacity: sucked ? 0 : 1,
                filter: sucked ? 'blur(4px)' : 'blur(0px)',
                transform: sucked
                    ? `translate(-50%, -50%) rotate(${angle}deg) scale(1.8, 0.3)`
                    : `translate(-50%, -50%) rotate(${angle}deg) scale(1, 1)`,
                transition: 'left 600ms cubic-bezier(.55,0,.85,.35), top 600ms cubic-bezier(.55,0,.85,.35), transform 600ms ease-in, filter 600ms ease-in, opacity 600ms ease-in',
                zIndex: 5,
            }}
        />
    );
};

export const FocusOrbLayer: React.FC<FocusOrbLayerProps> = ({ prayerOrbs, orbGroups = [], onToggleGroup, collapsing, orbPopup, setOrbPopup }) => (
    <>
        <style>{`
            @keyframes orb-pulse {
                0%, 100% { transform: translate(-50%,-50%) scale(1); }
                50%       { transform: translate(-50%,-50%) scale(1.18); }
            }
            @keyframes orb-float {
                0%, 100% { margin-top: 0px; }
                50%       { margin-top: -6px; }
            }
            @keyframes group-orb-pulse {
                0%, 100% { transform: translate(-50%,-50%) scale(1); }
                50%       { transform: translate(-50%,-50%) scale(1.12); }
            }
        `}</style>

        {prayerOrbs.map(orb => (
            <div
                key={orb.id}
                className="absolute rounded-full cursor-pointer"
                onClick={() => setOrbPopup(orb)}
                style={{
                    left: `${orb.x}%`,
                    top:  `${orb.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width:  '0.85em',
                    height: '0.85em',
                    fontSize: '1rem',
                    background: `radial-gradient(circle, white 0%, ${orb.color} 55%, ${orb.color}99 100%)`,
                    boxShadow: `0 0 5px 2px ${orb.color}88, 0 0 14px 4px ${orb.color}44`,
                    animation: 'orb-pulse 2.8s ease-in-out infinite, orb-float 3.4s ease-in-out infinite',
                    animationDelay: `${Math.random() * 2}s, ${Math.random() * 3}s`,
                    zIndex: 5,
                }}
            />
        ))}

        {collapsing?.orbs.map(orb => (
            <VacuumOrb key={orb.id} orb={orb} targetX={collapsing.x} targetY={collapsing.y} />
        ))}

        {orbGroups.map(group => (
            <div
                key={group.id}
                className="absolute rounded-full cursor-pointer"
                onClick={() => onToggleGroup?.(group.id)}
                title={`${group.orbs.length} grouped prayers`}
                style={{
                    left: `${group.x}%`,
                    top:  `${group.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width:  '1.9em',
                    height: '1.9em',
                    fontSize: '1rem',
                    background: `radial-gradient(circle, #ecfdf5 0%, ${group.color} 50%, ${group.color}cc 100%)`,
                    boxShadow: `0 0 10px 4px ${group.color}99, 0 0 26px 8px ${group.color}55`,
                    animation: 'group-orb-pulse 3.2s ease-in-out infinite, orb-float 4s ease-in-out infinite',
                    zIndex: 6,
                }}
            />
        ))}

        {orbGroups.filter(g => g.expanded).map(group => (
            <div
                key={`${group.id}-panel`}
                className="absolute z-20 inset-0 flex items-center justify-center"
                onClick={() => onToggleGroup?.(group.id)}
            >
                <div
                    className="relative max-w-sm w-full mx-6 rounded-2xl backdrop-blur-md bg-black/55 border p-4 shadow-xl"
                    style={{ borderColor: `${group.color}88` }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
                            🙏 {group.orbs.length} Grouped Prayers
                        </span>
                        <button
                            onClick={() => onToggleGroup?.(group.id)}
                            className="text-[11px] px-2 py-1 rounded-md text-white/70 hover:text-white transition-colors"
                            style={{ background: `${group.color}33` }}
                        >
                            Collapse
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto justify-center py-2">
                        {group.orbs.map(orb => (
                            <div
                                key={orb.id}
                                className="rounded-full cursor-pointer"
                                onClick={e => { e.stopPropagation(); setOrbPopup(orb); }}
                                style={{
                                    width: '1em',
                                    height: '1em',
                                    fontSize: '1rem',
                                    background: `radial-gradient(circle, white 0%, ${orb.color} 55%, ${orb.color}99 100%)`,
                                    boxShadow: `0 0 5px 2px ${orb.color}88, 0 0 14px 4px ${orb.color}44`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        ))}

        {orbPopup && (
            <div
                className="absolute z-30 inset-0 flex items-center justify-center"
                onClick={() => setOrbPopup(null)}
            >
                <div
                    className="relative max-w-xs w-full mx-6 rounded-2xl backdrop-blur-md bg-black/55 border p-4 shadow-xl"
                    style={{ borderColor: `${orbPopup.color}66` }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => setOrbPopup(null)}
                        className="absolute top-2 right-3 text-white/30 hover:text-white/70 text-sm leading-none"
                    >✕</button>
                    {orbPopup.text && (
                        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap pt-1 pr-4">
                            {orbPopup.text}
                        </p>
                    )}
                    {orbPopup.imageUrl && (
                        <img
                            src={orbPopup.imageUrl}
                            alt="Prayer drawing"
                            className="w-full rounded-lg object-contain max-h-64"
                        />
                    )}
                </div>
            </div>
        )}
    </>
);

