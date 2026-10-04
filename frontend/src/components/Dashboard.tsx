import React, { lazy, useState, useEffect } from "react";
import { isAdmin } from '../utils/adminConfig';
import { fetchAnimUrl as loadAnimationUrl } from "../utils/storageUtils";
import { useUser } from "../context/UserContext";
import PrayerBubble from "./PrayerBubble";
import CharacterTextField from "./CharacterTextField";
import NotesBubble from "./NotesBubble";
import useCharacterSkills from "../hooks/useCharacterSkills";
import useCharacterTransform from "../hooks/useCharacterTransform";
import CharacterGallery from "./CharacterGallery";
import PixelGallery from './PixelGallery';
import { findCharacter } from './pixels/pixelRegistry';
import { addUserCharacter, getUserCharacter, deleteUserCharacter, writeUserCharacter } from "../services/characterService";
// import MasteredSkillsArchive from "./MasteredSkillsArchive";
const ClassMode = lazy(() => import("./ClassMode"));
const MapModal = lazy(() => import("./MapModal"));
const CalendarModal = lazy(() => import("./CalendarModal"));
import { saveUserCharacter } from "../services/characterService";
import useCharacterLoader from "../hooks/useCharacterLoader";
import XPPanel from "./XPPanel";
import CharacterControls from "./CharacterControls";
import SkillsPanel from "./SkillsPanel";
import HPPanel from "./HPPanel";
const TrainingMode = lazy(() => import("./training/TrainingMode"));
import { xpThreshold } from "../utils/xpUtils";
import { getCharactersInPickerOrder } from "../utils/characterPicker";

// --------------------
// Dashboard: Constants
// --------------------
const MAX_HP = 100;

const Dashboard: React.FC = () => {
  const { user, loading: authLoading } = useUser();
  const uid: string | null = user?.uid ?? null; // uid, null if not signed in

  const { characters, userCharacters, setUserCharacters, loaded } = useCharacterLoader(uid);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem('dashboard.selectedId');
    } catch (err) {
      return null;
    }
  });
  const [animationUrl, setAnimationUrl] = useState("");
  const [woundedAnimUrl, setWoundedAnimUrl] = useState("");
  const [showSkills, setShowSkills] = useState(false);
  const [showScrollButton, setScrollButton] = useState(false);
  // transform state is now managed by a hook

  const [showClassMode, setShowClassMode] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return window.localStorage.getItem('dashboard.showClassMode') === '1';
    } catch (err) {
      return false;
    }
  });
  const [showMap, setShowMap] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [showTraining, setShowTraining] = useState<boolean>(false);
  // Data loading is handled by useCharacterLoader hook above.
  const cycleSelected = (dir: number) => {
    const list = getCharactersInPickerOrder(userCharacters);
    if (!list || list.length <= 1) return;
    const ids = list.map((c: any) => c.id);
    const idx = ids.indexOf(selectedId as string);
    if (idx === -1) return;
    const next = ids[(idx + dir + ids.length) % ids.length];
    setSelectedId(next);
  };

  // persist selectedId when it changes
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      if (selectedId) window.localStorage.setItem('dashboard.selectedId', selectedId);
      else window.localStorage.removeItem('dashboard.selectedId');
    } catch (err) {
      // ignore storage errors
    }
  }, [selectedId]);

  // persist showClassMode
  useEffect(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem('dashboard.showClassMode', showClassMode ? '1' : '0');
    } catch (err) {
      // ignore
    }
  }, [showClassMode]);

  const selectedCharacter = selectedId ? userCharacters[selectedId] : null;
  // --------------------
  // Persistence wrapper
  // - Delegate actual Firestore write to `characterService.saveUserCharacter`
  // --------------------
  const saveCharacter = async (c: any) => {
    if (!uid || !c?.id) return;
    return saveUserCharacter(uid, c);
  };

  const transformPixelCharacter = async (sourceId: string, targetId: string) => {
    if (!uid || !selectedCharacter) return;
    const pixelCharacters = { ...(selectedCharacter.pixelCharacters || {}) };
    if ((pixelCharacters[sourceId] || 0) < 10) return;

    pixelCharacters[sourceId] -= 10;
    // Miraculous characters are unique — never accumulate duplicates.
    if (findCharacter(targetId)?.rarity === 'miraculous') {
      pixelCharacters[targetId] = 1;
    } else {
      pixelCharacters[targetId] = (pixelCharacters[targetId] || 0) + 1;
    }

    const updated = { ...selectedCharacter, pixelCharacters };
    setUserCharacters(prev => ({ ...prev, [updated.id]: updated }));
    try {
      await writeUserCharacter(uid, updated.id, { pixelCharacters });
    } catch (error) {
      setUserCharacters(prev => ({ ...prev, [selectedCharacter.id]: selectedCharacter }));
      throw error;
    }
  };

  // transform state & actions (moved to hook for modularity)
  const {
    transformPlaying,
    transformOverlayUrl,
    transformReady,
    controlsDisabled,
    handleTransform,
    finalizeTransform,
  } = useCharacterTransform({ selectedCharacter, setUserCharacters, saveCharacter, setAnimationUrl });

  // --------------------
  // Hooks: Skill & Transform handlers
  // - `useCharacterTransform` handles transforms
  // - `useCharacterSkills` exposes skill CRUD helpers used below
  // --------------------

  // skill state & actions (moved to hook for modularity)
  // const [archiveToastCount, setArchiveToastCount] = useState<number>(0);
  // const [archiveUndoItems, setArchiveUndoItems] = useState<any[] | null>(null);
  const [creationToast, setCreationToast] = useState<string | null>(null);
  const [deletionToast, setDeletionToast] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const {
    showAddSkillForm,
    setShowAddSkillForm,
    newSkillName,
    setNewSkillName,
    addSkill,
    updateSkill,
    deleteSkill,
    addSubskill,
    updateSubskill,
    deleteSubskill,
    // archiveMasteredSkills,
    duplicateSkill,
    // archiveSkill,
    setSkillColor,
    prioritizeSkill,
  } = useCharacterSkills({
    userId: uid ?? undefined,
    selectedCharacter,
    setUserCharacters,
    saveCharacter,
    controlsDisabled,
    // onArchiveComplete: (archived: any[]) => {
    //   setArchiveToastCount(archived.length);
    //   setArchiveUndoItems(archived);
    //   window.setTimeout(() => {
    //     setArchiveToastCount(0);
    //     setArchiveUndoItems(null);
    //   }, 2200);
    // },
    // onSingleArchiveComplete: (item: any) => {
    //   setArchiveToastCount(1);
    //   setArchiveUndoItems([item]);
    //   window.setTimeout(() => {
    //     setArchiveToastCount(0);
    //     setArchiveUndoItems(null);
    //   }, 2200);
    // },
  });

  // const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  // const [archivePendingCount, setArchivePendingCount] = useState(0);

  // const requestArchive = () => {
  //   if (!selectedCharacter) return;
  //   const isCompleted = (p: any) => (p && (p.mastered === true || (typeof p.progress === 'number' && p.progress >= 100)));
  //   const mastered = (selectedCharacter.skills ?? []).filter((s: any) => {
  //     if (!isCompleted(s)) return false;
  //     const subs = s.subskills ?? [];
  //     return subs.every((ss: any) => isCompleted(ss));
  //   });
  //   const count = mastered.length;
  //   if (count === 0) return;
  //   setArchivePendingCount(count);
  //   setShowArchiveConfirm(true);
  // };

  // --------------------
  // Keyboard Shortcuts
  // - ArrowLeft/ArrowRight to cycle characters (ignores typing fields)
  // --------------------

  // keyboard shortcuts: ArrowLeft / ArrowRight to cycle characters (ignore when typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (controlsDisabled) return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        cycleSelected(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        cycleSelected(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, userCharacters, controlsDisabled]);






  // --------------------
  // HP Panel Helpers
  // - modifyHp, addXP: functions to mutate the selected character's HP/XP
  // --------------------
  const modifyHp = (delta: number) => {
    if (!selectedCharacter) return;
    const updated = {
      ...selectedCharacter,
      hp: Math.max(0, Math.min(MAX_HP, (selectedCharacter.hp ?? MAX_HP) + delta)),
    };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };



  // Load animation URL when character or their animation path changes (not on HP change)
  useEffect(() => {
    if (!selectedCharacter?.animation) {
      setAnimationUrl("");
      return;
    }
    loadAnimationUrl(selectedCharacter.animation)
      .then(setAnimationUrl)
      .catch((err) => {
        console.warn("Could not load animation:", err);
        setAnimationUrl("");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter?.animation]);

  // Load wounded URL when character switches or transforms (stable — does NOT re-run on HP change)
  useEffect(() => {
    // Look up woundedAnimations from merged char first, then fall back to raw base characters array
    const baseChar = characters.find((c: any) => c.id === selectedCharacter?.id);
    const woundedAnims: string[] =
      (selectedCharacter as any)?.woundedAnimations ??
      (baseChar as any)?.woundedAnimations ??
      [];
    const formIdx = Math.min(typeof selectedCharacter?.transformIndex === 'number' ? selectedCharacter.transformIndex : 0, 6);
    const woundedPath = woundedAnims[formIdx] || woundedAnims[0] || "";
    console.log("[wounded] character:", selectedCharacter?.id, "| woundedAnimations:", woundedAnims, "| path:", woundedPath || "(none)");
    if (!woundedPath) {
      setWoundedAnimUrl("");
      return;
    }
    loadAnimationUrl(woundedPath)
      .then(url => { console.log("[wounded] URL resolved:", url ? "OK" : "EMPTY", url); setWoundedAnimUrl(url || ""); })
      .catch(err => { console.warn("[wounded] URL fetch failed:", err); setWoundedAnimUrl(""); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter?.id, selectedCharacter?.transformIndex, characters.length]);

  // set a sensible default selected character when characters finish loading
  useEffect(() => {
    if (!loaded) return;
    const ids = Object.keys(userCharacters || {});
    // if selectedId already corresponds to a loaded character, keep it
    if (selectedId && userCharacters[selectedId]) return;

    // try stored id first
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('dashboard.selectedId');
        if (stored && userCharacters[stored]) {
          setSelectedId(stored);
          return;
        }
      }
    } catch (err) {
      // ignore
    }

    if (ids.length > 0) setSelectedId(ids[0]);
  }, [loaded, userCharacters, selectedId]);

  // --------------------
  // UI Sections (rendered below)
  // - Transform overlay, HP panel, Gallery, Prayers, Selector, XP panel, Skills list, Archive, Class Mode
  // --------------------

  // scroll button logic
  useEffect(() => {
    const onScroll = () => setScrollButton(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const hp = selectedCharacter?.hp ?? 100;
  const maxHp = selectedCharacter?.maxHp ?? 100;
  const displayAnimUrl = (hp <= maxHp * 0.5 && woundedAnimUrl) ? woundedAnimUrl : animationUrl;

  if (authLoading) return <div>Loading authentication...</div>;
  if (!uid) return <div>Please sign in to view your dashboard.</div>;
  if (!loaded) return <div>Loading...</div>;

  return (
    <div className="flex flex-col items-center min-h-screen bg-cyan-50 py-10 px-6">
      {/* Transform prompt overlay */}
      {transformReady && !transformPlaying && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 shadow-lg max-w-md text-center">
            <h3 className="text-xl font-bold mb-2">Transformation Ready!</h3>
            <p className="mb-4">{selectedCharacter?.name} has reached level {selectedCharacter?.level}! Press Transform to continue!</p>
            <div className="flex justify-center gap-4">
              <button onClick={handleTransform} className="px-4 py-2 bg-rose-500 text-white rounded">Transform</button>
            </div>
          </div>
        </div>
      )}

      {/* Transform playing overlay */}
      {transformPlaying && transformOverlayUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <video src={transformOverlayUrl} autoPlay onEnded={finalizeTransform} className="w-3/4 h-auto max-h-[80vh]" />
        </div>
      )}
<div className="w-full max-w-4xl">
  <p className="text-center text-gray-700 mb-4">{user?.displayName || user?.email || 'Player'}</p>
</div>
      <CharacterGallery onCreateUserCharacter={async (base: any, playerName: string) => {
        if (!uid) {
          alert('Please sign in to create a new character instance.');
          return;
        }

        // Limit non-admin users to 10 characters total (6 defaults + 4 additional)
        if (!isAdmin(uid)) {
          const currentCount = Object.keys(userCharacters).length;
          if (currentCount >= 10) {
            alert('Character limit reached. You can have up to 10 characters total.');
            return;
          }
        }

        if (!playerName) return;

        // build payload for per-user character
        const payload = {
          // keep `name` pointing to the base character's display name
          name: base.name || base._migratedFrom || base.id,
          // `playerName` is the per-user entered name (student/player)
          playerName: playerName,
          animation: base.animation ?? base.defaultAnimation,
          hp: 100,
          maxHp: 100,
          xp: 0,
          level: 1,
          skills: [],
          createdAt: Date.now(),
        } as any;

        try {
          const newId = await addUserCharacter(uid, payload);

          // fetch the freshly-created user character (this call will enrich with base `characters` fallback fields)
          const fresh = await getUserCharacter(uid, newId);
          const mergedItem = fresh ? ({ id: newId, ...fresh } as any) : ({ id: newId, ...payload } as any);

          setUserCharacters((prev) => ({ ...prev, [newId]: mergedItem }));
          // select the new character
          setSelectedId(newId);

          // show a short toast confirming creation
          setCreationToast(`Created ${playerName}`);
          window.setTimeout(() => setCreationToast(null), 2200);
        } catch (err) {
          console.error('Error creating user character', err);
          alert('Could not create character — check console for details');
        }
      }} />

      {/* Pixel Gallery: character-specific owned pixel characters */}
      <PixelGallery selectedCharacter={selectedCharacter} onTransform={transformPixelCharacter} />





      {/* Character Selector */}
      <CharacterControls
        uid={uid}
        userCharacters={userCharacters}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        setUserCharacters={setUserCharacters}
        animationUrl={displayAnimUrl}
        controlsDisabled={controlsDisabled}
        onCycle={cycleSelected}
        saveCharacter={saveCharacter}
      />

      <HPPanel
        hp={hp}
        onModifyHp={modifyHp}
        controlsDisabled={controlsDisabled}
        smallName={selectedCharacter ? selectedCharacter.name : undefined}
        displayName={selectedCharacter ? (selectedCharacter.playerName && selectedCharacter.playerName.length ? selectedCharacter.playerName : selectedCharacter.name) : undefined}
        />

      {selectedCharacter && (
        <XPPanel uid={uid} selectedCharacter={selectedCharacter} setUserCharacters={setUserCharacters} saveCharacter={saveCharacter} controlsDisabled={controlsDisabled} />
      )}


      {selectedCharacter && (
        <NotesBubble characterId={selectedCharacter.id} disabled={controlsDisabled} />
      )}

      {/* Skills panel extracted */}
      {selectedCharacter && (
        <SkillsPanel
        selectedCharacter={selectedCharacter}
          controlsDisabled={controlsDisabled}
          showSkills={showSkills}
          setShowSkills={setShowSkills}
          showAddSkillForm={showAddSkillForm}
          setShowAddSkillForm={setShowAddSkillForm}
          newSkillName={newSkillName}
          setNewSkillName={setNewSkillName}
          addSkill={addSkill}
          updateSkill={updateSkill}
          deleteSkill={deleteSkill}
          addSubskill={addSubskill}
          updateSubskill={updateSubskill}
          deleteSubskill={deleteSubskill}
          // archiveMasteredSkills={() => requestArchive()}
          // onArchiveSkill={archiveSkill}
          onPrioritizeSkill={prioritizeSkill}
          onColorChangeSkill={setSkillColor}
          duplicateSkill={duplicateSkill}
          setUserCharacters={setUserCharacters}
          saveCharacter={saveCharacter}
          setShowClassMode={setShowClassMode}
          setShowCalendar={setShowCalendar}
          setShowMap={setShowMap}
          setShowTraining={setShowTraining}
          uid={uid}
          />
        )}
      {showMap && (
        <MapModal onClose={() => setShowMap(false)} userId={uid} characterId={selectedCharacter ? selectedCharacter.id : null} />
      )}

      {showCalendar && (
        <CalendarModal onClose={() => setShowCalendar(false)} characterId={selectedCharacter ? selectedCharacter.id : null} />
      )}  

      {/* Prayers for selected character */}
      {selectedCharacter && (
        <PrayerBubble
        characterId={selectedCharacter.id}
        disabled={controlsDisabled}
        selectedCharacter={selectedCharacter}
        setUserCharacters={setUserCharacters}
        saveCharacter={saveCharacter}
        onPrayerLevelUp={() => {
          // State + Firestore save already handled by FocusOverlay in one update.
          // Reserved for future UI effects (e.g. level-up overlay).
        }}
        />
      )}

      {/* {selectedCharacter && (
        <MasteredSkillsArchive
        archived={selectedCharacter.archivedSkills ?? []}
        onDelete={async (item: any) => {
          if (!selectedCharacter) return;
          const updated = {
            ...selectedCharacter,
            archivedSkills: (selectedCharacter.archivedSkills ?? []).filter((a: any) => a.id !== item.id),
          } as any;
          setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
          try {
            await saveCharacter(updated);
          } catch (err) {
            console.error('Error deleting archived skill', err);
          }
        }}
        onRestore={async (item: any) => {
          if (!selectedCharacter) return;
          const archived = (selectedCharacter.archivedSkills ?? []).slice();
          archived.push(item);
          const updated = {
            ...selectedCharacter,
            archivedSkills: archived.sort((a: any, b: any) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
          } as any;
          setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
          try {
            await saveCharacter(updated);
          } catch (err) {
            console.error('Error restoring archived skill', err);
          }
        }}
        onRevive={async (item: any) => {
          if (!selectedCharacter) return;
          // Build revived skill with progress reset to 0 and subskills reset
          const existing = (selectedCharacter.skills ?? []).slice();
          let newId = item.originalSkillId ?? item.id;
          if (existing.find((s: any) => s.id === newId)) {
            newId = `${newId}-revived-${Date.now()}`;
          }
          const revived = {
            id: newId,
            name: item.name,
            difficulty: item.difficulty,
            progress: 0,
            mastered: false,
            subskills: (item.subskills || []).map((ss: any) => ({ ...ss, progress: 0, mastered: false })),
            createdAt: Date.now(),
          } as any;
          
          const restored = [revived, ...existing];
          
          const remainingArchived = (selectedCharacter.archivedSkills ?? []).filter((x: any) => x.id !== item.id);
          
          const updated = { ...selectedCharacter, skills: restored, archivedSkills: remainingArchived } as any;
          setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
          try {
            await saveCharacter(updated);
          } catch (err) {
            console.error('Error reviving archived skill', err);
          }
        }}
        />
      )} */}
      {/* Delete character — shown for any selected character */}
      {selectedCharacter && (
        <div className="w-full max-w-md mx-auto my-4 flex justify-center">
          <button
            onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-lg text-sm font-medium transition-colors"
          >
             Delete Character
          </button>
        </div>
      )}
{/* 
      {archiveToastCount > 0 && (
        <div className="fixed top-24 right-6 z-50">
          <div className="bg-black text-white px-4 py-2 rounded shadow-lg flex items-center gap-3">
            <div>Archived {archiveToastCount} skill{archiveToastCount === 1 ? '' : 's'}</div>
            {archiveUndoItems && (
              <button
                onClick={async () => {
                  if (!selectedCharacter || !archiveUndoItems || archiveUndoItems.length === 0) return;
                  // restore archived items back to skills and remove them from archivedSkills
                  const restored = (selectedCharacter.skills ?? []).slice();
                  // restore in original order: archived were appended to archivedSkills; archived array contains items in order added
                  for (const a of archiveUndoItems) {
                    // ensure we don't duplicate if already present
                    if (!restored.find((s: any) => s.id === a.originalSkillId || s.id === a.id)) {
                      // attempt to reconstruct the original skill shape
                      const original = {
                        id: a.originalSkillId ?? a.id,
                        name: a.name,
                        difficulty: a.difficulty,
                        progress: 100,
                        mastered: true,
                        subskills: a.subskills ?? [],
                        completedAt: a.completedAt,
                        createdAt: a.createdAt ?? Date.now(),
                      };
                      restored.unshift(original);
                    }
                  }

                  const remainingArchived = (selectedCharacter.archivedSkills ?? []).filter((x: any) => !archiveUndoItems.find((a: any) => a.id === x.id));

                  const updated = { ...selectedCharacter, skills: restored, archivedSkills: remainingArchived } as any;
                  setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
                  try {
                    await saveCharacter(updated);
                  } catch (err) {
                    console.error('Error restoring archived skills', err);
                  }

                  setArchiveToastCount(0);
                  setArchiveUndoItems(null);
                }}
                className="underline text-white text-sm"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {showArchiveConfirm && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-40 flex items-center justify-center" onClick={() => setShowArchiveConfirm(false)}>
          <div className="bg-white rounded-lg p-6 shadow-lg w-[90%] max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-center text-lg font-semibold mb-4">Would you like to archive {archivePendingCount} item{archivePendingCount === 1 ? '' : 's'}?</div>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => { setShowArchiveConfirm(false); }} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={async () => { setShowArchiveConfirm(false); try { await archiveMasteredSkills(); } catch (err) { console.error(err); } }} className="px-4 py-2 bg-cyan-600 text-white rounded">Yes, archive</button>
            </div>
          </div>
        </div>
      )} */}

      {showDeleteModal && selectedCharacter && (() => {
        const displayName = selectedCharacter.playerName?.trim() || selectedCharacter.name || '';
        const confirmed = deleteConfirmText.trim() === displayName;
        const handleDelete = async () => {
          if (!uid || !confirmed) return;
          try {
            await deleteUserCharacter(uid, selectedCharacter.id);
            const deletedName = selectedCharacter.playerName?.trim() || selectedCharacter.name || 'Character';
            setUserCharacters(prev => {
              const next = { ...prev };
              delete next[selectedCharacter.id];
              return next;
            });
            // Select the next available character
            const remaining = Object.keys(userCharacters).filter(id => id !== selectedCharacter.id);
            setSelectedId(remaining.length > 0 ? remaining[0] : null);
            setDeletionToast(`${deletedName} deleted`);
            window.setTimeout(() => setDeletionToast(null), 2500);
          } catch (err) {
            console.error('Error deleting character', err);
            alert('Failed to delete character. Please try again.');
          } finally {
            setShowDeleteModal(false);
            setDeleteConfirmText('');
          }
        };
        return (
          <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(false)}>
            <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="text-red-600 font-bold text-lg mb-1">Delete Character</div>
              <div className="text-sm text-gray-600 mb-4">
                This action <span className="font-semibold text-gray-800">cannot be undone</span>. All data for <span className="font-semibold">{displayName}</span> will be permanently deleted.
              </div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-bold">{displayName}</span> to confirm
              </label>
              <input
                autoFocus
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmed) handleDelete(); }}
                placeholder={displayName}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:border-red-400"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={!confirmed}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {creationToast && (
        <div className="fixed top-20 right-6 z-50">
          <div className="bg-green-700 text-white px-4 py-2 rounded shadow-lg">{creationToast}</div>
        </div>
      )}

      {deletionToast && (
        <div className="fixed top-20 right-6 z-50">
          <div className="bg-purple-700 text-white px-4 py-2 rounded shadow-lg">{deletionToast}</div>
        </div>
      )}

      {showTraining && (
        <TrainingMode
          uid={uid}
          allCharacters={(() => {
            const base = characters || [];
            const extra = Object.values(userCharacters || {}).filter((u: any) => !base.find((b: any) => b.id === u.id));
            return [...base, ...extra].map((ch: any) => {
              const uc = userCharacters[ch.id] ?? ch ?? {};
              const animPath = (uc.animation || uc.defaultAnimation) || ch?.defaultAnimation || ch?.animation;
              const transformIdx = typeof uc.transformIndex === 'number' ? uc.transformIndex : (ch?.transformIndex ?? 0);
              const formIdx = Math.min(transformIdx, 6);
              const actionAnims: string[] = uc.actionAnimations ?? ch?.actionAnimations ?? [];
              const damageAnims: string[] = uc.damageAnimations ?? ch?.damageAnimations ?? [];
              const defeatAnims: string[] = uc.defeatAnimations ?? ch?.defeatAnimations ?? [];
              const woundedAnims: string[] = uc.woundedAnimations ?? ch?.woundedAnimations ?? [];
              return {
                id: ch.id,
                name: uc.playerName || uc.name || ch?.name || ch.id,
                hp: uc.hp ?? ch?.hp ?? 100,
                maxHp: uc.maxHp ?? ch?.maxHp ?? 100,
                xp: typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0),
                level: typeof uc.level === 'number' ? uc.level : (ch.level ?? 1),
                animUrl: undefined,
                animPath: animPath || undefined,
                actionAnimPath: actionAnims[formIdx] || undefined,
                damageAnimPath: damageAnims[formIdx] || undefined,
                defeatAnimPath: defeatAnims[formIdx] || defeatAnims[0] || undefined,
                woundedAnimPath: woundedAnims[formIdx] || woundedAnims[0] || undefined,
                actionAnimations: actionAnims.length ? actionAnims : undefined,
                damageAnimations: damageAnims.length ? damageAnims : undefined,
                defeatAnimations: defeatAnims.length ? defeatAnims : undefined,
                woundedAnimations: woundedAnims.length ? woundedAnims : undefined,
                transformThresholds: (uc.transformThresholds ?? ch?.transformThresholds ?? []) as number[],
                transformIndex: transformIdx,
              };
            });
          })()}
          onAwardXP={async (charId: string, delta: number) => {
            const ch = (characters || []).find((x: any) => x.id === charId) ?? {} as any;
            const uc = userCharacters[charId] ?? ch ?? {};
            const curXp = typeof uc.xp === 'number' ? uc.xp : (ch.xp ?? 0);
            const curLevel = typeof uc.level === 'number' ? uc.level : (ch.level ?? 1);
            let newXp = curXp + delta;
            let newLevel = curLevel;
            while (newXp >= xpThreshold(newLevel)) {
              newXp -= xpThreshold(newLevel);
              newLevel++;
            }
            const updated = { ...uc, xp: newXp, level: newLevel };
            setUserCharacters((prev: any) => ({ ...prev, [charId]: updated }));
            try { await saveCharacter(updated); } catch (e) { console.error(e); }
          }}
          onSetHp={async (charId: string, hp: number) => {
            const ch = (characters || []).find((x: any) => x.id === charId) ?? {} as any;
            const uc = userCharacters[charId] ?? ch ?? {};
            const updated = { ...uc, hp };
            setUserCharacters((prev: any) => ({ ...prev, [charId]: updated }));
            try { await saveCharacter(updated); } catch (e) { console.error(e); }
          }}
          onNavigateToCharacter={(id: string) => { setSelectedId(id); setShowTraining(false); }}
          onClose={() => setShowTraining(false)}
        />
      )}

      {showClassMode && isAdmin(uid) && (
        <ClassMode
          uid={uid}
          characters={characters}
          userCharacters={userCharacters}
          setUserCharacters={setUserCharacters}
          saveCharacter={saveCharacter}
          updateSkill={updateSkill}
          onClose={() => setShowClassMode(false)}
          navigateToCharacter={(id: string) => { setSelectedId(id); setShowClassMode(false); }}
          controlsDisabled={controlsDisabled}
        />
      )}

      {showScrollButton && (
        <button onClick={() => window.scrollTo({ top: 250, behavior: "smooth" })} className="fixed bottom-6 right-6 bg-cyan-600 text-white p-3 rounded-full shadow-lg">^</button>
      )}
    </div>
  );
};

export default Dashboard;