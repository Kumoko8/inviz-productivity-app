import React, { useState } from 'react';
import type { Character } from '../types/character';

interface Props {
    selectedCharacter: Character | null;
    animationUrl: string;
    controlsDisabled?: boolean;
    onCycle: (dir: number) => void;
    onRenamePlayer?: (newName: string) => void;
    onManageGroup?: () => void;
}

const CharacterSelector: React.FC<Props> = ({ selectedCharacter, animationUrl, controlsDisabled = false, onCycle, onRenamePlayer, onManageGroup }) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');

    if (!selectedCharacter) return null;

    const displayName = selectedCharacter.playerName && selectedCharacter.playerName.length
        ? selectedCharacter.playerName
        : selectedCharacter.name;

    const startEdit = () => {
        if (controlsDisabled) return;
        setDraft(displayName);
        setEditing(true);
    };

    const commitEdit = () => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== displayName) {
            onRenamePlayer?.(trimmed);
        }
        setEditing(false);
    };

    return (
        <div className="mt-4 text-center w-64 h-64 relative mx-auto">
            <button
                aria-label="Previous character"
                onClick={() => onCycle(-1)}
                disabled={controlsDisabled}
                className="absolute -left-8 top-1/2 transform -translate-y-1/2 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-100"
            >
                ‹
            </button>

            <button
                aria-label="Next character"
                onClick={() => onCycle(1)}
                disabled={controlsDisabled}
                className="absolute -right-8 top-1/2 transform -translate-y-1/2 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow hover:bg-gray-100"
            >
                ›
            </button>

            {animationUrl && (
                <video key={animationUrl} src={animationUrl} autoPlay loop muted playsInline className="w-64 h-64 object-cover mx-auto" />
            )}
            <div className="mt-2 flex items-center justify-center gap-1 font-bold">
                {editing ? (
                    <input
                        autoFocus
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit();
                            if (e.key === 'Escape') setEditing(false);
                        }}
                        className="border-b border-gray-400 bg-transparent text-center font-bold outline-none w-40"
                    />
                ) : (
                    <span
                        onClick={startEdit}
                        title="Click to rename"
                        className="cursor-pointer hover:text-cyan-600 transition-colors"
                    >
                        {displayName}
                    </span>
                )}
                {onManageGroup && (
                    <button
                        aria-label="Manage character group"
                        title="Manage character group"
                        onClick={onManageGroup}
                        disabled={controlsDisabled}
                        className="grid grid-cols-2 gap-px p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        <span className="w-1.5 h-1.5 bg-gray-600" />
                        <span className="w-1.5 h-1.5 bg-gray-600" />
                        <span className="w-1.5 h-1.5 bg-gray-600" />
                        <span className="w-1.5 h-1.5 bg-gray-600" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default CharacterSelector;
