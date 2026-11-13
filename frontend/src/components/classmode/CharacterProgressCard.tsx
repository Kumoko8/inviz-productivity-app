import React from 'react';
import { totalXpForLevel, xpThreshold } from '../../utils/xpUtils';
import {
    ResponsiveStill,
    WOUNDED_HP,
    type StillFrames,
    type StillState,
} from './CharacterStill';

type CardCharacter = {
    name?: string;
    hp?: number;
    maxHp?: number;
    xp?: number;
    level?: number;
    currencyXp?: number;
    stillFrames?: StillFrames;
};

type Props = {
    c: CardCharacter;
    uc: CardCharacter;
    baseStillFrames?: StillFrames;
    animUrl?: string;
    animLoading?: boolean;
    selected: boolean;
    stillEvent?: 'earnXp' | 'loseHp';
    stillVersion: number;
    isAdmin: boolean;
    controlsDisabled: boolean;
    xpAnimatingFull?: boolean;
    xpLevelToast?: boolean;
    onEditStill: (name: string) => void;
    onChangeHp: (delta: number) => void;
    onChangeXp: (delta: number) => void;
};

export default function CharacterProgressCard({
    c,
    uc,
    baseStillFrames,
    animUrl,
    animLoading,
    selected,
    stillEvent,
    stillVersion,
    isAdmin,
    controlsDisabled,
    xpAnimatingFull,
    xpLevelToast,
    onEditStill,
    onChangeHp,
    onChangeXp,
}: Props) {
    const hp = typeof uc.hp === 'number' ? uc.hp : (c.hp ?? 100);
    const maxHp = typeof uc.maxHp === 'number' ? uc.maxHp : (c.maxHp ?? 100);
    const hpPct = Math.max(
        0,
        Math.min(100, Math.round((hp / (maxHp || 1)) * 100))
    );
    const xp = typeof uc.xp === 'number' ? uc.xp : (c.xp ?? 0);
    const level = typeof uc.level === 'number' ? uc.level : (c.level ?? 1);
    const totalXp =
        typeof uc.currencyXp === 'number'
            ? Math.max(0, Math.floor(uc.currencyXp))
            : totalXpForLevel(level, xp);
    const nextLevelXP = xpThreshold(level);
    const xpPercent = Math.max(
        0,
        Math.min(100, Math.round((xp / Math.max(1, nextLevelXP)) * 100))
    );
    const stillFrames: StillFrames | undefined =
        uc.stillFrames ?? baseStillFrames;
    const stillState: StillState =
        stillEvent ?? (hp <= WOUNDED_HP ? 'wounded' : 'default');
    return (
        <div className="mt-2">
            <div className="w-full bg-white border rounded overflow-hidden flex items-center justify-center relative">
                {animLoading ? (
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                ) : (animUrl || stillFrames) && selected ? (
                    <ResponsiveStill
                        frames={stillFrames}
                        state={stillState}
                        videoUrl={animUrl}
                        className="w-full h-40 "
                        version={stillVersion}
                    />
                ) : (
                    <div className="text-xs text-gray-400 py-6">
                        {selected ? 'No preview' : 'Click name to select'}
                    </div>
                )}
            </div>

            {isAdmin && selected && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onEditStill(String(uc.name ?? c.name ?? ''));
                    }}
                    className="mt-1 px-2 py-0.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded"
                >
                    🎨 Edit image
                </button>
            )}

            <div className="mt-2">
                <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                        HP {hp}/{maxHp}
                    </div>
                    <span className="text-xs font-normal text-cyan-700">
                        Total XP: {totalXp}
                    </span>
                    <div className="text-sm font-medium">Level {level} </div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 bg-red-100 rounded h-2 overflow-hidden">
                        <div
                            className="h-2 transition-all duration-1000 ease-out"
                            style={{
                                width: `${hpPct}%`,
                                background: '#3ce6a2',
                                willChange: 'width',
                            }}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChangeHp(-10);
                            }}
                            disabled={controlsDisabled}
                            className="px-2 py-0.5 text-xs bg-gray-100 rounded"
                        >
                            -
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onChangeHp(10);
                            }}
                            disabled={controlsDisabled}
                            className="px-2 py-0.5 text-xs bg-gray-100 rounded"
                        >
                            +
                        </button>
                    </div>
                </div>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!controlsDisabled) onChangeXp(25);
                    }}
                    title="Click to add 25 XP"
                    className={`mt-1 w-full bg-blue-100 rounded h-2 overflow-hidden ${controlsDisabled ? '' : 'cursor-pointer'}`}
                >
                    <div
                        className="h-2 transition-all duration-1000 ease-out"
                        style={{
                            width: `${xpAnimatingFull ? 100 : xpPercent}%`,
                            background: '#0ea5e9',
                            willChange: 'width',
                            boxShadow: xpLevelToast
                                ? '0 0 10px rgba(14,165,233,0.6)'
                                : undefined,
                        }}
                    />
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                    {xp}/{nextLevelXP} XP
                </div>
            </div>
        </div>
    );
}
