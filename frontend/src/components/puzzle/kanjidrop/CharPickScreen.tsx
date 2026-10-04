import React from 'react';
import type { PuzzleCharacterOption } from '../PuzzleMode';

type Props = {
    tapMode: boolean;
    allCharacters: PuzzleCharacterOption[];
    selectedCharId: string | null;
    onSelectChar: (id: string) => void;
    onStart: () => void;
    onClose: () => void;
};

const CharPickScreen: React.FC<Props> = ({
    tapMode, allCharacters, selectedCharId, onSelectChar, onStart, onClose,
}) => (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
        <div className="text-5xl mb-2" style={{ fontFamily: 'serif' }}>漢</div>
        <h2 className="text-2xl font-bold text-white mb-1">Kanji Builder</h2>
        <p className="text-gray-400 text-sm mb-6 text-center max-w-xs">
            {tapMode
                ? 'Tap a radical to select it, then tap the board to place it. Drag tiles on the board to combine them!'
                : 'Drag radical tiles onto the board and combine them next to each other to form the target kanji!'}
        </p>
        {allCharacters.length > 0 && (
            <>
                <label className="text-gray-300 text-sm mb-2" htmlFor="kd-char-select">Award XP to:</label>
                <select
                    id="kd-char-select"
                    value={selectedCharId ?? ''}
                    onChange={e => onSelectChar(e.target.value)}
                    className="w-full max-w-xs mb-6 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-gray-100 text-sm focus:outline-none focus:border-yellow-400"
                >
                    {allCharacters.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </>
        )}
        <button
            onClick={onStart}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-purple-900/40"
        >
            Start Building
        </button>
    </div>
);

export default CharPickScreen;
