import React, { useState } from 'react';

type Props = {
    charId: string;
    skillId: string;
    userCharacters: Record<string, any>;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    saveCharacter: (c: any) => Promise<void>;
    controlsDisabled?: boolean;
    onOpenChange?: (open: boolean) => void;
    buttonLabel?: string;
};

const SubskillCreator: React.FC<Props> = ({ charId, skillId, userCharacters, setUserCharacters, saveCharacter, controlsDisabled, onOpenChange, buttonLabel }) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    // difficulty removed
    // tags removed

    const openEditor = () => {
        setName('');
        setOpen(true);
        if (onOpenChange) onOpenChange(true);
    };

    const closeEditor = () => {
        setOpen(false);
        if (onOpenChange) onOpenChange(false);
    };

    const handleSave = async () => {
        const now = Date.now();
        const uc = userCharacters[charId] ?? {};
        const newSub = { id: `${now}_${Math.random().toString(36).slice(2, 6)}`, name: name.trim(), progress: 0, mastered: false, createdAt: now };
        const updated = { ...uc, skills: (uc.skills ?? []).map((s: any) => s.id === skillId ? { ...s, subskills: [...(s.subskills ?? []), newSub] } : s) };
        setUserCharacters(prev => ({ ...prev, [charId]: updated }));
        try { await saveCharacter(updated); } catch (e) { console.error(e); }
        closeEditor();
    };

    return (
        <div className="flex flex-col" style={open ? { flexBasis: '100%' } : undefined}>
            {!open ? (
                <button onClick={openEditor} className="px-2 py-1 bg-gray-100 text-xs rounded" disabled={controlsDisabled}>{buttonLabel || '+Sub'}</button>
            ) : (
                <div className="mt-2 p-2 bg-gray-50 border rounded w-full">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Subskill name" className="w-full border rounded px-2 py-1 text-sm" />
                    <div className="flex gap-2 mt-2 items-center">
                        {/* difficulty removed */}
                    </div>
                    <div className="flex gap-2 mt-2 justify-start">
                        <button onClick={handleSave} className="px-2 py-1 bg-emerald-500 text-white rounded text-xs">Save</button>
                        <button onClick={closeEditor} className="px-2 py-1 bg-gray-200 rounded text-xs">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubskillCreator;
