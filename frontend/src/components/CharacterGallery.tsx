import React, { useEffect, useState } from "react";
import ToggleArrow from "./ToggleArrow";
import { getCharacters } from "../services/characterService";
import GalleryTile from "./GalleryTile";
import usePreviewLoader from "../hooks/usePreviewLoader";

type Props = {
    names?: string[]; // names to show (case-insensitive). Defaults to specific set.
    onCreateUserCharacter?: (baseCharacter: any, playerName: string) => void; // called when user picks a base and supplies player name
};

const DEFAULT_NAMES = ["Yumi", "Kiiro", "Maguro", "Mushi", "Kumo", "Roku"];


const CharacterGallery: React.FC<Props> = ({ names, onCreateUserCharacter }) => {
    const [open, setOpen] = useState(false);
    const [displayNames, setDisplayNames] = useState<string[]>(names && names.length > 0 ? names : DEFAULT_NAMES);
    const [baseChars, setBaseChars] = useState<any[]>([]);
    const [selectedBase, setSelectedBase] = useState<any | null>(null);
    const [playerName, setPlayerName] = useState<string>('');
    const [showModal, setShowModal] = useState(false);
    const { urls } = usePreviewLoader(displayNames);

    useEffect(() => {
        let mounted = true;
        const loadNames = async () => {
            try {
                if (!names || names.length === 0) {
                    // fetch base characters from Firestore if no explicit names provided
                    const bases = await getCharacters();
                    const namesFromBase = (bases || []).map((b: any) => (b.name as string) || "");
                    if (mounted) {
                        setDisplayNames(namesFromBase.length > 0 ? namesFromBase : DEFAULT_NAMES);
                        setBaseChars(bases || []);
                    }
                } else {
                    setDisplayNames(names);
                }
            } catch (err) {
                console.error('CharacterGallery: could not load base character list', err);
                if (mounted) setDisplayNames(DEFAULT_NAMES);
            }
        };
        loadNames();
        return () => { mounted = false; };
    }, [names]);

    // preview URLs are loaded by `usePreviewLoader`

    return (
        <div className="w-full max-w-md mx-auto my-4">
            <div className="flex items-center justify-between bg-white border rounded px-3 py-2 shadow-sm">
                <div className="font-semibold">Character Gallery </div>
                <button
                    onClick={() => setOpen(prev => !prev)}
                    aria-label={open ? 'Hide gallery' : `Show gallery (${displayNames.length})`}
                    className="p-1 bg-white rounded-full w-9 h-9 flex items-center justify-center shadow hover:bg-gray-100"
                >
                    <ToggleArrow open={open} size={18} />
                </button>
            </div>

            {open && (
                <div className="mt-3 bg-white border rounded p-3 grid grid-cols-3 gap-3">
                    <div className="col-span-3 mb-2 font-semibold text-center">Choose A Character</div>
                    {displayNames.map((n) => {
                        const base = baseChars.find((b: any) => (b.name || '').toString() === n) || null;
                        return (
                            <div key={n} className="flex items-center justify-center">
                                <div onClick={() => base ? handleSelectBase(base) : null} className="cursor-pointer">
                                    <GalleryTile name={n} url={urls[n]} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* Modal for entering player name */}
            {showModal && selectedBase && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold mb-2">Create Player for {selectedBase.name}</h3>
                        <p className="text-sm text-gray-600 mb-4">Enter the player/student name </p>
                        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full border rounded px-3 py-2 mb-4" placeholder="Player name" />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setShowModal(false); setSelectedBase(null); setPlayerName(''); }} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                            <button onClick={() => {
                                if (!playerName.trim()) return;
                                if (onCreateUserCharacter) onCreateUserCharacter(selectedBase, playerName.trim());
                                setShowModal(false);
                                setSelectedBase(null);
                                setPlayerName('');
                            }} className="px-3 py-1 bg-blue-500 text-white rounded">Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // select handler moved below so it can use baseChars
    function handleSelectBase(base: any) {
        // open modal to collect player name
        setSelectedBase(base);
        setPlayerName('');
        setShowModal(true);
    }
};

export default CharacterGallery;
