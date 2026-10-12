import React from 'react';
import usePixelRegistry from '../hooks/usePixelRegistry';
import { getCharacterGroups, getCharacterPool, PIXEL_RARITY_ORDER } from './pixels/pixelRegistry';
import PixelSprite from './pixels/PixelSprite';

type Props = { onClose: () => void };

const RARITY_STYLES: Record<string, string> = {
    common: 'bg-gray-200 text-gray-700',
    uncommon: 'bg-emerald-100 text-emerald-700',
    rare: 'bg-sky-100 text-sky-700',
    special: 'bg-amber-100 text-amber-700',
    miraculous: 'bg-violet-200 text-violet-800',
};

const PixelCharacterPreview: React.FC<Props> = ({ onClose }) => {
    usePixelRegistry();
    const groups = getCharacterGroups();
    const pool = getCharacterPool();

    const sections = Object.entries(groups).map(([groupId, label]) => ({
        groupId,
        label,
        characters: pool
            .filter(c => c.group === groupId)
            .sort((a, b) => PIXEL_RARITY_ORDER.indexOf(a.rarity) - PIXEL_RARITY_ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name)),
    }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-full overflow-y-auto p-4 flex flex-col gap-4">
                <div className="flex items-center">
                    <h2 className="text-lg font-bold flex-1">Pixel Character Preview ({pool.length})</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
                </div>
                {sections.map(({ groupId, label, characters }) => (
                    <section key={groupId}>
                        <h3 className="font-semibold text-gray-800 border-b mb-2">{label} <span className="text-xs text-gray-500">({characters.length})</span></h3>
                        {characters.length === 0 ? (
                            <div className="text-xs text-gray-500">No characters yet.</div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {characters.map(c => (
                                    <div key={c.id} className="flex flex-col items-center gap-1 p-2 border rounded bg-gray-50">
                                        <PixelSprite id={c.id} scale={2} fps={6} />
                                        <div className="text-xs font-medium text-center leading-tight">{c.name}</div>
                                        <span className={`text-[10px] px-1.5 rounded-full ${RARITY_STYLES[c.rarity] ?? ''}`}>{c.rarity}</span>
                                        <code className="text-[10px] text-gray-500">{c.id}</code>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
};

export default PixelCharacterPreview;
