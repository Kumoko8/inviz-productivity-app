import React from "react";

type Props = {
    hp: number;
    onModifyHp: (delta: number) => void;
    controlsDisabled: boolean;
    maxHp?: number;
    smallName?: string;
    displayName?: string;
};

const HPPanel: React.FC<Props> = ({ hp, onModifyHp, controlsDisabled, maxHp = 100, smallName, displayName }) => {
    const getHpColorClass = (hpValue: number) => {
        if (hpValue >= 90) return 'bg-cyan-500'; // healthy green
        if (hpValue >= 80) return 'bg-lime-400'; // puke green
        if (hpValue >= 70) return 'bg-yellow-300'; // sickly yellow
        if (hpValue >= 50) return 'bg-orange-400'; // orange
        if (hpValue >= 20) return 'bg-red-500'; // red
        return 'bg-red-800'; // very dark red
    };

    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const colorClass = getHpColorClass(hp);

    return (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-3">
            <div className="mb-2">
                {smallName && (
                    <div className="text-sm font-medium text-gray-700 mb-2">{smallName}</div>
                )}
                <div className="flex items-center justify-between mb-2">
                    <button onClick={() => onModifyHp(-10)} className="px-4 py-2 bg-pink-500 text-white rounded-md" disabled={controlsDisabled}>-10</button>

                    <div className="text-center">
                        <div className="text-sm text-gray-700">HP: {hp}/{maxHp}</div>
                    </div>

                    <button onClick={() => onModifyHp(+10)} className="px-4 py-2 bg-lime-500 text-white rounded-md" disabled={controlsDisabled}>+10</button>
                </div>
            </div>

            <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden">
                <div className={`${colorClass} h-6 transition-all duration-1000 ease-out`} style={{ width: `${pct}%`, willChange: 'width' }} />
            </div>
        </div>
    );
};

export default HPPanel;
