import React from 'react';
import { prayerPointsThreshold } from '../../utils/xpUtils';

interface FocusPrayerBarProps {
    selectedCharacter?: any;
    ppLevelUp: boolean;
    xpNotif: { amount: number; fill: number; leveledUp: boolean } | null;
}

const BAR_COLORS = ['bg-amber-400', 'bg-green-400', 'bg-cyan-400', 'bg-violet-400'];

export const FocusPrayerBar: React.FC<FocusPrayerBarProps> = ({ selectedCharacter, ppLevelUp, xpNotif }) => {
    const pp    = (selectedCharacter?.prayerPoints as number | undefined) ?? 0;
    const ppLvl = (selectedCharacter?.prayerLevel  as number | undefined) ?? 1;
    const total = prayerPointsThreshold(ppLvl);
    const pct   = Math.min(100, Math.round((pp / Math.max(1, total)) * 100));
    const barColor = BAR_COLORS[(ppLvl - 1) % BAR_COLORS.length];

    return (
        <div className="absolute top-4 left-4 z-10 flex items-start gap-3">
            {/* Prayer level progress bar */}
            <div className="flex flex-col gap-1 min-w-[140px] max-w-[180px]">
                <div className="flex items-center justify-between text-xs text-gray-400 font-semibold px-0.5">
                    <span>祈　Prayer Lv.{ppLvl}</span>
                    <span>{pp}/{total}</span>
                </div>
                <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor} ${pct >= 100 ? 'animate-pulse' : ''}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                {ppLevelUp && (
                    <div className="text-xs text-yellow-300 font-bold text-center animate-bounce">
                        ✨ Prayer Level Up!
                    </div>
                )}
            </div>

            {/* XP gained notification */}
            {xpNotif && (
                <div className="bg-white border border-amber-400 rounded-lg shadow-lg px-3 py-2 w-36 pointer-events-none">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-amber-600">+{xpNotif.amount} XP</span>
                        {xpNotif.leveledUp && (
                            <span className="text-xs font-bold text-emerald-500">⬆ Lv Up!</span>
                        )}
                    </div>
                    <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                        <div
                            className="h-2 bg-amber-400 rounded transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, xpNotif.fill)}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
