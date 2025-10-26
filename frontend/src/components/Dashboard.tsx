import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useUser } from "../context/UserContext";
import { useAutoSave } from "../hooks/useAutoSave";
import { UserData, Skill, CharacterProgress } from "../types/UserData";

import SkillItem from "../components/SkillItem";
import XPBar from "../components/XPBar";

const Dashboard: React.FC = () => {
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData>({
    xp: 0,
    skills: [],
    characters: [],
  });

  // Load saved data when user logs in
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<UserData>;
        setUserData({
          xp: data.xp ?? 0,
          skills: data.skills ?? [],
          characters: data.characters ?? [],
        });
      }
    };
    loadData();
  }, [user]);

  // Auto-save whenever data changes
  useAutoSave(userData, "users");

  // Add new skill
  const addSkill = () => {
    const name = prompt("Enter a new skill:");
    if (!name) return;
    const newSkill: Skill = { name, progress: 0, mastered: false };
    setUserData((prev) => ({
      ...prev,
      skills: [...prev.skills, newSkill],
    }));
  };

  // Update skill progress
  const updateSkill = (index: number, newProgress: number) => {
    setUserData((prev) => {
      const updated = [...prev.skills];
      updated[index].progress = newProgress;
      if (newProgress >= 100) updated[index].mastered = true;
      return { ...prev, skills: updated };
    });
  };
  // Delete skill
const deleteSkill = (index: number) => {
  setUserData((prev) => {
    const updated = [...prev.skills];
    updated.splice(index, 1);
    return { ...prev, skills: updated };
  });
};


  // Select a character
  const addCharacter = (name: string) => {
    if (userData.characters.find((c) => c.name === name)) return;
    const newChar: CharacterProgress = { name, level: 1, xp: 0 };
    setUserData((prev) => ({
      ...prev,
      characters: [...prev.characters, newChar],
    }));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-3">Dashboard</h1>
      <p>XP: {userData.xp}</p>

      <button
        onClick={() => setUserData({ ...userData, xp: userData.xp + 10 })}
        className="bg-blue-500 text-white px-3 py-1 rounded"
      >
        +10 XP
      </button>

      {/* Skills Section */}
      <div className="mt-6 bg-gray-100 p-3 rounded">
        <h2 className="text-lg font-semibold mb-2">Skills</h2>
        <button
          onClick={addSkill}
          className="bg-green-500 text-white px-2 py-1 rounded mb-3"
        >
          + Add Skill
        </button>

        {userData.skills.map((skill, i) => (
          <SkillItem
            key={i}
            name={skill.name}
            progress={skill.progress}
            onProgressUpdate={(p) => updateSkill(i, p)}
            onMaster={() => updateSkill(i, 100)}
            onDelete={() => deleteSkill(i)}
          />
        ))}
      </div>

      {/* Characters Section */}
      <div className="mt-6 bg-gray-100 p-3 rounded">
        <h2 className="text-lg font-semibold mb-2">Characters</h2>
        <button
          onClick={() => addCharacter("Mage")}
          className="bg-purple-500 text-white px-2 py-1 rounded"
        >
          + Add Mage
        </button>

        {userData.characters.map((char, i) => (
          <div key={i} className="border p-2 rounded mt-2">
            <p className="font-medium">{char.name}</p>
            <XPBar
              title="XP"
              initialLevel={char.level}
              initialProgress={char.xp}
              thresholds={[100, 200, 400]}
              confirmedImages={[]}
              onProgressChange={(xp, level) =>
                setUserData((prev) => {
                  const chars = [...prev.characters];
                  chars[i].xp = xp;
                  chars[i].level = level;
                  return { ...prev, characters: chars };
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
