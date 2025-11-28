import React, { useState, useEffect } from "react";
import { auth, db, storage } from "../firebase";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";

import { Character, Skill, Prayer } from "../types/character";
import SkillItem from "../components/SkillItem";
import PrayerBubble from "./PrayerBubble";
import CharacterTextField from "./CharacterTextField";

async function loadAnimationUrl(animation: string): Promise<string> {
  const storageRef = ref(storage, animation);
  return await getDownloadURL(storageRef);
}

const MAX_HP = 100;

const Dashboard: React.FC = () => {
  const user = auth.currentUser;
  const uid = user?.uid ?? null; // local uid, null if not signed in

  const [characters, setCharacters] = useState<Character[]>([]);
  const [userCharacters, setUserCharacters] = useState<Record<string, any>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [animationUrl, setAnimationUrl] = useState("");
  const [showSkills, setShowSkills] = useState(true);
  const [showScrollButton, setScrollButton] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load base characters + user's per-character docs
  useEffect(() => {
    if (!uid) return;

    const loadAll = async () => {
      // load base characters collection
      const baseSnap = await getDocs(collection(db, "characters"));
      const baseCharacters: Character[] = baseSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setCharacters(baseCharacters);

      // load user's character subcollection: users/{uid}/characters
      const userCharSnap = await getDocs(
        collection(db, "users", uid, "characters")
      );

      const userCharMap: Record<string, any> = {};

      // create map from user docs. We expect user doc ids to match base character ids
      for (const docSnap of userCharSnap.docs) {
        userCharMap[docSnap.id] = docSnap.data();
      }

      // merge base + user data (ensuring skills/prayers are arrays)
      const merged: Record<string, any> = {};
      for (const base of baseCharacters) {
        const u = userCharMap[base.id] ?? {};
        merged[base.id] = {
          ...base,
          hp: typeof u.hp === "number" ? u.hp : u.hp ?? MAX_HP,
          maxHp: typeof u.maxHp === "number" ? u.maxHp : u.maxHp ?? MAX_HP,
          xp: typeof u.xp === "number" ? u.xp : u.xp ?? 0,
          level: typeof u.level === "number" ? u.level : u.level ?? 1,
          skills: Array.isArray(u.skills) ? u.skills : [],
          prayers: Array.isArray(u.prayers) ? u.prayers : [],
          createdAt: u.createdAt ?? Date.now(),
        };
      }

      setUserCharacters(merged);

      // if no selection, pick first available character
      if (!selectedId && baseCharacters.length > 0) {
        setSelectedId(baseCharacters[0].id);
      }

      setLoaded(true);
    };

    loadAll().catch((err) => console.error("loadAll error:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const selectedCharacter = selectedId ? userCharacters[selectedId] : null;

  // Save user-character doc (users/{uid}/characters/{characterId})
  const saveCharacter = async (c: any) => {
    if (!uid || !c?.id) return;
    const ref = doc(db, "users", uid, "characters", c.id);
    const payload = {
      hp: c.hp,
      maxHp: c.maxHp,
      xp: c.xp,
      level: c.level,
      skills: c.skills ?? [],
      prayers: c.prayers ?? [],
      createdAt: c.createdAt ?? Date.now(),
    };
    await setDoc(ref, payload, { merge: true });
  };

  // HP
  const modifyHp = (delta: number) => {
    if (!selectedCharacter) return;
    const updated = {
      ...selectedCharacter,
      hp: Math.max(0, Math.min(MAX_HP, (selectedCharacter.hp ?? MAX_HP) + delta)),
    };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };

  // XP
  const addXP = (amount: number) => {
    if (!selectedCharacter) return;

    const curXp = selectedCharacter.xp ?? 0;
    const curLevel = selectedCharacter.level ?? 1;
    let newXP = curXp + amount;
    let newLevel = curLevel;

    let nextXP = Math.pow(newLevel, 3);
    while (newXP >= nextXP) {
      newXP -= nextXP;
      newLevel++;
      nextXP = Math.pow(newLevel, 3);
    }

    const updated = { ...selectedCharacter, xp: newXP, level: newLevel };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };

  // Skills
  const addSkill = () => {
    if (!selectedCharacter) {
      alert("Please select a character first");
      return;
    }
    const name = prompt("Enter a new skill:");
    if (!name) return;
    const newSkill: Skill = {
      id: Date.now().toString(),
      name,
      progress: 0,
      mastered: false,
    };
    const updated = {
      ...selectedCharacter,
      skills: [newSkill, ...(selectedCharacter.skills ?? [])],
    };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };

  const updateSkill = (skillId: string, progress: number, mastered = false) => {
    if (!selectedCharacter) return;
    const updated = {
      ...selectedCharacter,
      skills: (selectedCharacter.skills ?? []).map((s: Skill) =>
        s.id === skillId ? { ...s, progress, mastered } : s
      ),
    };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };

  const deleteSkill = (skillId: string) => {
    if (!selectedCharacter) return;
    const updated = {
      ...selectedCharacter,
      skills: (selectedCharacter.skills ?? []).filter((s: Skill) => s.id !== skillId),
    };
    setUserCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    saveCharacter(updated).catch(console.error);
  };

  // Load animation URL on selected character change
  useEffect(() => {
    if (!selectedCharacter || !selectedCharacter.animation) {
      setAnimationUrl("");
      return;
    }
    loadAnimationUrl(selectedCharacter.animation)
      .then(setAnimationUrl)
      .catch((err) => {
        console.warn("Could not load animation:", err);
        setAnimationUrl("");
      });
  }, [selectedCharacter]);

  // scroll button logic
  useEffect(() => {
    const onScroll = () => setScrollButton(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!uid) return <div>Please sign in to view your dashboard.</div>;
  if (!loaded) return <div>Loading...</div>;

  const xp = selectedCharacter?.xp ?? 0;
  const level = selectedCharacter?.level ?? 1;
  const nextLevelXP = Math.pow(level, 3);
  const xpPercent = (xp / Math.max(1, nextLevelXP)) * 100;
  const hp = selectedCharacter?.hp ?? MAX_HP;

  return (
    <div className="flex flex-col items-center min-h-screen bg-cyan-50 py-10 px-6">
      {/* HP */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8">
        <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">HP</h2>

        <div className="flex items-center justify-between mb-4">
          <button onClick={() => modifyHp(-10)} className="px-4 py-2 bg-pink-500 text-white rounded-md">-10</button>

          <div className="text-lg font-semibold text-gray-800">HP: {hp}/{MAX_HP}</div>

          <button onClick={() => modifyHp(+10)} className="px-4 py-2 bg-lime-500 text-white rounded-md">+10</button>
        </div>

        <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden">
          <div className="bg-cyan-500 h-6 transition-all" style={{ width: `${(hp / MAX_HP) * 100}%` }} />
        </div>
      </div>

      {/* Prayers for selected character */}
      {selectedCharacter && <PrayerBubble characterId={selectedCharacter.id} />}

      {/* Character Selector */}
      <div className="mt-4">
        <label className="font-semibold">Choose Character:</label>
        <select className="ml-2 border rounded px-2 py-1" value={selectedId || ""} onChange={(e) => setSelectedId(e.target.value || null)}>
          <option value="">Select...</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {selectedCharacter && (
          <div className="mt-4 text-center w-64 h-64 relative">
            {animationUrl && (
              <video src={animationUrl} autoPlay loop muted playsInline className="w-64 h-64 object-cover" />
            )}
            <p className="mt-2 font-bold">{selectedCharacter.name}</p>
          </div>
        )}
      </div>

      <CharacterTextField selectedCharacter={selectedCharacter} />

      {/* Skills */}
      {selectedCharacter && (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8">
          <button onClick={() => setShowSkills(prev => !prev)}>{showSkills ? "▾" : "▸"}</button>

          <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">Skills</h2>

          {showSkills && (
            <>
              <button onClick={addSkill} className="mb-4 px-3 py-1 bg-blue-500 text-white rounded">+ Add Skill</button>

              <div className="flex flex-col gap-4">
                {(selectedCharacter.skills ?? []).map((skill: Skill) => (
                  <SkillItem
                    key={skill.id}
                    name={skill.name}
                    progress={skill.progress}
                    onProgressUpdate={(p) => updateSkill(skill.id, p, p >= 100)}
                    onMaster={() => updateSkill(skill.id, 100, true)}
                    onDelete={() => deleteSkill(skill.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* XP */}
      {selectedCharacter && (
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200">
          <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">XP</h2>

          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-800 font-semibold">Level: <span className="text-cyan-700">{level}</span></div>
            <div className="text-gray-800 font-semibold">XP: <span className="text-cyan-700">{xp}/{nextLevelXP}</span></div>
          </div>

          <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden mb-4">
            <div className="bg-yellow-400 h-6 transition-all" style={{ width: `${xpPercent}%` }} />
          </div>

          <div className="flex justify-center gap-4">
            <button onClick={() => addXP(10)} className="px-4 py-2 bg-cyan-500 text-white rounded-md">+10 XP</button>
            <button onClick={() => addXP(25)} className="px-4 py-2 bg-purple-500 text-white rounded-md">+25 XP</button>
          </div>
        </div>
      )}

      {showScrollButton && (
        <button onClick={() => window.scrollTo({ top: 250, behavior: "smooth" })} className="fixed bottom-6 right-6 bg-cyan-600 text-white p-3 rounded-full shadow-lg">^</button>
      )}
    </div>
  );
};

export default Dashboard;