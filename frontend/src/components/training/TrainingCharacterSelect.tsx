import React, { useState } from "react";
import usePixelRegistry from "../../hooks/usePixelRegistry";
import { findCharacter } from "../pixels/pixelRegistry";
import { abilityForCompanion, ABILITY_LABELS } from "../pixels/pixelAbilities";

export interface CharacterOption {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    xp?: number;
    level?: number;
    animUrl?: string;
    animPath?: string;
    actionAnimPath?: string;
    damageAnimPath?: string;
    defeatAnimPath?: string;
    woundedAnimPath?: string;
    // full arrays kept so TrainingMode can re-index after a level-up
    actionAnimations?: string[];
    damageAnimations?: string[];
    defeatAnimations?: string[];
    woundedAnimations?: string[];
    transformThresholds?: number[];
    transformIndex?: number;
    pixelCharacters?: Record<string, number>; // owned pixel characters (id -> count)
    companionId?: string; // pixel companion chosen for this training session
}

interface Props {
    characters: CharacterOption[];
    onConfirm: (selected: CharacterOption[]) => void;
    onBack: () => void;
}

const MAX_SELECT = 3;

const TrainingCharacterSelect: React.FC<Props> = ({ characters, onConfirm, onBack }) => {
    usePixelRegistry();
    const [search, setSearch] = useState("");
    const [companions, setCompanions] = useState<Record<string, string>>({});
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const filtered = characters.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(x => x !== id));
        } else if (selectedIds.length < MAX_SELECT) {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleConfirm = () => {
        const sel = characters
            .filter(c => selectedIds.includes(c.id))
            .map(c => ({ ...c, companionId: companions[c.id] || undefined }));
        onConfirm(sel);
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="text-center">
                <h3 className="font-bold text-lg text-purple-700">Choose Characters</h3>
                <p className="text-xs text-gray-400">Select up to {MAX_SELECT}</p>
            </div>

            <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search characters…"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
            />

            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {filtered.length === 0 && (
                    <div className="text-center text-gray-400 text-sm py-4">No characters found</div>
                )}
                {filtered.map(c => {
                    const isSelected = selectedIds.includes(c.id);
                    const isDisabled = !isSelected && selectedIds.length >= MAX_SELECT;
                    const ownedPixels = Object.keys(c.pixelCharacters ?? {}).filter(pid => (c.pixelCharacters?.[pid] ?? 0) > 0);
                    return (
                        <div key={c.id} className="flex flex-col gap-1">
                        <button
                            onClick={() => toggle(c.id)}
                            disabled={isDisabled}
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition text-left
                                ${isSelected
                                    ? "border-purple-500 bg-purple-50"
                                    : isDisabled
                                        ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                                        : "border-gray-200 hover:border-purple-300 hover:bg-purple-50"
                                }`}
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                                {c.animUrl
                                    ? <img src={c.animUrl} alt={c.name} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                                    : <span className="text-xl">🧙</span>
                                }
                            </div>

                            {/* Name + HP */}
                            <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-gray-800 truncate">{c.name}</div>
                                <div className="text-xs text-gray-400">HP: {c.hp} / {c.maxHp}</div>
                            </div>

                            {/* Selection indicator */}
                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                ${isSelected ? "border-purple-500 bg-purple-500" : "border-gray-300"}`}>
                                {isSelected && <span className="text-white text-xs leading-none">✓</span>}
                            </div>
                        </button>
                        {isSelected && (
                            <label className="flex items-center gap-2 px-3 text-xs text-gray-500">
                                Companion
                                <select
                                    value={companions[c.id] ?? ""}
                                    onChange={e => setCompanions(prev => ({ ...prev, [c.id]: e.target.value }))}
                                    disabled={ownedPixels.length === 0}
                                    className="flex-1 border rounded px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
                                >
                                    <option value="">{ownedPixels.length === 0 ? "None owned — going alone" : "Go alone"}</option>
                                    {ownedPixels.map(pid => <option key={pid} value={pid}>{findCharacter(pid)?.name ?? pid}</option>)}
                                </select>
                            </label>
                        )}
                        {isSelected && abilityForCompanion(companions[c.id]) && (
                            <div className="px-3 text-[11px] text-purple-600">✨ {ABILITY_LABELS[abilityForCompanion(companions[c.id])!]}</div>
                        )}
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2 pt-1">
                <button
                    onClick={onBack}
                    className="flex-1 px-4 py-2 text-sm text-gray-500 hover:text-gray-800 border rounded-lg transition"
                >
                    ← Back
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={selectedIds.length === 0}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Start ({selectedIds.length})
                </button>
            </div>
        </div>
    );
};

export default TrainingCharacterSelect;
