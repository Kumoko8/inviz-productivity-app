import React, { useRef, useState } from 'react';
import CharacterSelector from './CharacterSelector';
import GroupSkillImportDialog from './GroupSkillImportDialog';
import type { GroupSkillImportCandidate } from './GroupSkillImportDialog';
import { isAdmin } from '../utils/adminConfig';
import { addUserCharacter, getUserCharacter } from '../services/characterService';
import { getCommonGroupSkills, getMissingGroupSkills, importMissingGroupSkills } from '../utils/groupSkillImport';
import { getCharacterPickerSections } from '../utils/characterPicker';

interface Props {
    uid: string | null;
    userCharacters: Record<string, any>;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    setUserCharacters: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    animationUrl: string;
    controlsDisabled?: boolean;
    onCycle: (dir: number) => void;
    saveCharacter?: (c: any) => Promise<any> | void;
}

const CharacterControls: React.FC<Props> = ({ uid, userCharacters, selectedId, setSelectedId, setUserCharacters, animationUrl, controlsDisabled = false, onCycle, saveCharacter }) => {
    const [showPrivateModal, setShowPrivateModal] = useState(false);
    const [privateName, setPrivateName] = useState('');
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [editedGroupName, setEditedGroupName] = useState('');
    const [pendingGroupSkillImport, setPendingGroupSkillImport] = useState<{ group: string; candidate: GroupSkillImportCandidate } | null>(null);
    const [groupSkillImportConfirm, setGroupSkillImportConfirm] = useState<string | null>(null);
    const groupSkillImportConfirmTimeout = useRef<number | null>(null);
    const cancelGroupRename = useRef(false);
    const { ungroupedCharacters, groupedCharacters } = getCharacterPickerSections(userCharacters);
    const groups = groupedCharacters.map(({ group }) => group);

    const assignSelectedToGroup = async (group: string) => {
        if (!selectedId) return;
        const current = userCharacters[selectedId];
        if (!current) return;
        const targetGroup = group.trim();
        const updated = { ...current, characterGroup: targetGroup };
        const enteringNewGroup = targetGroup !== '' && (current.characterGroup || '').trim() !== targetGroup;
        const peers = enteringNewGroup
            ? Object.values(userCharacters).filter((character: any) =>
                character.id !== selectedId && (character.characterGroup || '').trim() === targetGroup
            )
            : [];
        const missingSkills = getMissingGroupSkills(updated, getCommonGroupSkills(peers));
        setUserCharacters(prev => ({ ...prev, [selectedId]: updated }));
        await Promise.resolve(saveCharacter?.(updated)).catch(console.error);
        setShowGroupModal(false);
        setNewGroupName('');
        if (missingSkills.length > 0) {
            setPendingGroupSkillImport({
                group: targetGroup,
                candidate: {
                    characterId: selectedId,
                    characterName: current.playerName || current.name || selectedId,
                    skills: missingSkills,
                },
            });
        }
    };

    const importSkillsForSelectedCharacter = async () => {
        if (!pendingGroupSkillImport) return;
        const { group, candidate } = pendingGroupSkillImport;
        const current = userCharacters[candidate.characterId];
        if (current) {
            const withGroup = { ...current, characterGroup: group };
            const updated = importMissingGroupSkills(withGroup, candidate.skills);
            if (updated !== withGroup) {
                const importedCount = (updated.skills?.length ?? 0) - (current.skills?.length ?? 0);
                setUserCharacters(prev => ({ ...prev, [candidate.characterId]: updated }));
                try {
                    await Promise.resolve(saveCharacter?.(updated));
                    if (importedCount > 0) {
                        if (groupSkillImportConfirmTimeout.current) window.clearTimeout(groupSkillImportConfirmTimeout.current);
                        setGroupSkillImportConfirm(`${importedCount} skill${importedCount === 1 ? '' : 's'} imported for ${candidate.characterName}`);
                        groupSkillImportConfirmTimeout.current = window.setTimeout(() => setGroupSkillImportConfirm(null), 3000) as unknown as number;
                    }
                } catch (error) {
                    console.error('Failed to save imported group skills', error);
                }
            }
        }
        setPendingGroupSkillImport(null);
    };

    const renameGroup = async (group: string) => {
        if (cancelGroupRename.current) {
            cancelGroupRename.current = false;
            setEditingGroup(null);
            return;
        }
        const renamedGroup = editedGroupName.trim();
        if (!renamedGroup || renamedGroup === group) {
            setEditingGroup(null);
            return;
        }
        const updates = Object.values(userCharacters)
            .filter((character: any) => character.characterGroup?.trim() === group)
            .map((character: any) => ({ ...character, characterGroup: renamedGroup }));
        setUserCharacters(prev => ({
            ...prev,
            ...Object.fromEntries(updates.map((character: any) => [character.id, character])),
        }));
        await Promise.all(updates.map((character: any) => Promise.resolve(saveCharacter?.(character)).catch(console.error)));
        setEditingGroup(null);
        setEditedGroupName('');
    };

    return (
        <div className="mt-4">
            {groupSkillImportConfirm !== null && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="bg-purple-600 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-xl animate-bounce-once text-center">
                        {groupSkillImportConfirm}
                    </div>
                </div>
            )}
            <label className="font-semibold">Choose Character:</label>
            <select className="ml-2 border rounded px-2 py-1 text-black" value={selectedId || ''} onChange={(e) => setSelectedId(e.target.value || null)}>
                <option value="">Select...</option>
                {ungroupedCharacters.map((c: any) => (
                    <option key={c.id} value={c.id}>{(c.playerName && c.playerName.length) ? c.playerName : c.name}</option>
                ))}
                {groupedCharacters.map(({ group, characters }) => (
                    <optgroup key={group} label={group}>
                        {characters.map((c: any) => (
                            <option key={c.id} value={c.id}>&nbsp;&nbsp;{(c.playerName && c.playerName.length) ? c.playerName : c.name}</option>
                        ))}
                    </optgroup>
                ))}
            </select>

            {isAdmin(uid) && (
                <>
                    <button
                        className="ml-3 px-3 py-1 bg-amber-500 text-black rounded"
                        onClick={() => { setPrivateName(''); setShowPrivateModal(true); }}
                    >Add Character</button>

                    {showPrivateModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                            <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-sm">
                                <h3 className="text-lg font-semibold mb-3">Create Character</h3>
                                <input
                                    value={privateName}
                                    onChange={(e) => setPrivateName(e.target.value)}
                                    placeholder="Character name"
                                    className="w-full border rounded px-2 py-1 mb-3"
                                />
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setShowPrivateModal(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                                    <button onClick={async () => {
                                        const name = privateName.trim();
                                        if (!name) return alert('Please enter a name');
                                        try {
                                            const payload = {
                                                name,
                                                xp: 0,
                                                animation: `characters/${name}_1.mp4`,
                                                level: 1,
                                                hp: 100,
                                                maxHp: 100,
                                                ownerUid: uid,
                                                skills: [],
                                                createdAt: Date.now(),
                                            } as any;
                                            const newId = await addUserCharacter(uid as string, payload);
                                            // fetch enriched doc (merge from base characters at read-time)
                                            const fresh = await getUserCharacter(uid as string, newId);
                                            const newDoc = fresh ? ({ id: newId, ...fresh } as any) : ({ id: newId, ...payload } as any);
                                            setUserCharacters((prev) => ({ ...prev, [newId]: newDoc }));
                                            setSelectedId(newId);
                                            setShowPrivateModal(false);
                                            setPrivateName('');
                                        } catch (err) {
                                            console.error('Error creating private character', err);
                                            alert('Could not create private character');
                                        }
                                    }} className="px-3 py-1 bg-amber-500 text-black rounded">Create</button>
                                </div>
                            </div>
                        </div>
                    )}


                </>
            )}

            <CharacterSelector
                selectedCharacter={selectedId ? userCharacters[selectedId] : null}
                animationUrl={animationUrl}
                controlsDisabled={controlsDisabled}
                onCycle={onCycle}
                onRenamePlayer={(newName) => {
                    if (!selectedId) return;
                    const current = userCharacters[selectedId];
                    if (!current) return;
                    const updated = { ...current, playerName: newName };
                    setUserCharacters(prev => ({ ...prev, [selectedId]: updated }));
                    saveCharacter?.(updated);
                }}
                onManageGroup={() => { setNewGroupName(''); setEditingGroup(null); setShowGroupModal(true); }}
            />

            {showGroupModal && selectedId && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-5 shadow-lg w-full max-w-sm">
                        <div className="text-lg font-semibold mb-3">Character Group</div>
                        <div className="text-sm text-gray-600 mb-3">{userCharacters[selectedId]?.playerName || userCharacters[selectedId]?.name}</div>
                        {groups.length > 0 && (
                            <div className="flex flex-col gap-2 mb-3">
                                {groups.map(group => (
                                    <div key={group} className="flex items-center gap-1">
                                        {editingGroup === group ? (
                                            <input
                                                autoFocus
                                                value={editedGroupName}
                                                onChange={event => setEditedGroupName(event.target.value)}
                                                onBlur={() => renameGroup(group)}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter') void renameGroup(group);
                                                    if (event.key === 'Escape') {
                                                        cancelGroupRename.current = true;
                                                        event.currentTarget.blur();
                                                    }
                                                }}
                                                className="flex-1 border rounded px-3 py-2"
                                            />
                                        ) : (
                                            <button onClick={() => assignSelectedToGroup(group)} className="flex-1 text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded">
                                                {group}
                                            </button>
                                        )}
                                        <button
                                            aria-label={`Rename ${group} group`}
                                            title="Rename group"
                                            onClick={() => { setEditingGroup(group); setEditedGroupName(group); }}
                                            className="p-2 text-gray-400 hover:text-gray-600"
                                        >
                                            ✎
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-2 mb-3">
                            <input value={newGroupName} onChange={event => setNewGroupName(event.target.value)} placeholder="New group name" className="flex-1 border rounded px-2 py-1" />
                            <button onClick={() => assignSelectedToGroup(newGroupName)} disabled={!newGroupName.trim()} className="px-3 py-1 bg-cyan-500 text-white rounded disabled:opacity-50">Create</button>
                        </div>
                        {userCharacters[selectedId]?.characterGroup && (
                            <button onClick={() => assignSelectedToGroup('')} className="text-sm text-red-600 hover:underline">Remove from group</button>
                        )}
                        <div className="flex justify-end mt-4">
                            <button onClick={() => setShowGroupModal(false)} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {pendingGroupSkillImport && (
                <GroupSkillImportDialog
                    group={pendingGroupSkillImport.group}
                    candidates={[pendingGroupSkillImport.candidate]}
                    onImport={() => { void importSkillsForSelectedCharacter(); }}
                    onSkip={() => setPendingGroupSkillImport(null)}
                />
            )}
        </div>
    );
};

export default CharacterControls;
