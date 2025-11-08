import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import SkillItem from "../components/SkillItem";
import Characters from "../components/CharacterData";

interface Skill {
  id: string;
  name: string;
  progress: number;
  mastered: boolean;
}

const Dashboard: React.FC = () => {
  const user = auth.currentUser;
  const [loaded, setLoaded] = useState(false);
  const [characterHp, setCharacterHp] = useState<Record<string, number>>({});
  const [characterXp, setCharacterXp] = useState<Record<string, {xp: number, level: number}>>({});
  const [characterSkills, setCharacterSkills] = useState<Record<string, Skill[]>>({});
  // const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<any | null>(
    null
  );

  const MAX_HP = 100;


  // Load user data from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setCharacterHp(data.characterHp ?? {});
        setCharacterXp(data.characterXp ?? {});
        setCharacterSkills(data.characterSkills ?? {});
        setSelectedCharacter(data.character ?? null);
      } else {
        // initialize user doc
        await setDoc(ref, {
          hp: 100,
          xp: 0,
          level: 1,
          skills: [],
          character: null,
        }, {merge: true}
      );
      }
      setLoaded(true);
    };
    fetchData();
  }, [user]);

  // Save user data automatically whenever values change
  useEffect(() => {
    if (!loaded || !user) return;
    const saveData = async () => {
      const ref = doc(db, "users", user.uid);
      await updateDoc(ref, {
        character: selectedCharacter, characterSkills, characterHp, characterXp,
      });
    };
    saveData();
  }, [characterHp, characterXp, characterSkills, selectedCharacter, loaded, user]);

  const currentCharName = selectedCharacter?.name || "default";
  // --- HP Controls ---
  
  
  const decreaseHP = () => setCharacterHp((prev) => ({...prev, [currentCharName]: Math.max((prev[currentCharName] || 100) - 10, 0),})) ;
  const increaseHP = () => 
  setCharacterHp((prev) => ({...prev, [currentCharName]: Math.min((prev[currentCharName] || 100) + 10, MAX_HP),})) ;
  
  // --- XP Controls ---
  const addXP = (amount: number) => {
    setCharacterXp((prev) => {
      const current = prev[currentCharName] || {xp: 0, level: 1};
      let newXP = current.xp + amount;
      let newLevel = current.level;
      
      let nextLevelXP = Math.pow(newLevel, 3);
      
      while(newXP >= nextLevelXP) {
        newXP -= nextLevelXP;
        newLevel += 1;
        nextLevelXP = Math.pow(newLevel, 3);
      }
      return {
        ...prev, [selectedCharacter?.name]:{ xp: newXP, level: newLevel}
      }
    })
  };
  
  // --- Skills ---
  
  const handleAddSkill = () => {
    if(!selectedCharacter){
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
    setCharacterSkills((prev) => ({...prev, [currentCharName]:[...(prev[currentCharName] || []), newSkill], }));
  };
  
  const handleProgressUpdate = (
    id: string,
    newProgress: number,
    mastered = false
  ) => {
    setCharacterSkills((prev) => ({...prev, [currentCharName]: prev[currentCharName].map((s) => s.id === id ? {...s, progress: newProgress, mastered} : s)})
    
  );
};

const handleDeleteSkill = (id: string) => {
  if (!confirm("Are you sure you want to delete this skill?")) return;
  setCharacterSkills((prev) => ({...prev, [currentCharName]: prev[currentCharName].filter((s) => s.id !== id)}));
};

const { xp, level } = characterXp[selectedCharacter?.name] || {xp:0, level: 1};
const nextLevelXP = Math.pow(level, 3);
const xpPercent = (xp / nextLevelXP) * 100;
  const hp = characterHp[currentCharName] ?? MAX_HP;

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-cyan-50 py-10 px-6">
      {/* HP Section */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8">
        <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">
          HP
        </h2>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={decreaseHP}
            className="px-4 py-2 bg-pink-500 text-white rounded-md hover:bg-pink-600 transition"
          >
            -10
          </button>

          <div className="text-lg font-semibold text-gray-800">
            HP: {hp}/{MAX_HP}
          </div>

          <button
            onClick={increaseHP}
            className="px-4 py-2 bg-lime-500 text-white rounded-md hover:bg-lime-600 transition"
          >
            +10
          </button>
        </div>

        <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden">
          <div
            className="bg-cyan-500 h-6 transition-all duration-300"
            style={{ width: `${(hp / MAX_HP) * 100}%` }}
          />
        </div>
      </div>

      {/* Character Selector */}
      <div className="mt-4">
  <label className="font-semibold">Choose Character:</label>
  <select
    className="ml-2 border rounded px-2 py-1"
    value={selectedCharacter?.name || ""}
    onChange={(e) => {
      const char = Characters.find((c) => c.name === e.target.value);
      setSelectedCharacter(char || null);
    }}
  >
    <option value="">Select...</option>
    {Characters.map((c) => (
      <option key={c.name} value={c.name}>
        {c.name}
      </option>
    ))}
  </select>
  {/* animation */}
  {selectedCharacter && (
    <div className="mt-4 text-center">
      
      {selectedCharacter?.animation && (
        <video src={selectedCharacter.animation} autoPlay loop muted className="w-64 h-64 object-cover" aria-label={`${selectedCharacter.name} animation`}/>
        
      )}
      <p className="mt-2 font-bold">{selectedCharacter.name}</p>
    </div>
  )}
</div>

      {/* Skill Tracker */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200 mb-8">
        <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">
          Skills
        </h2>

        <button
          onClick={handleAddSkill}
          className="mb-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Add Skill
        </button>

        <div className="flex flex-col gap-4">
          {(characterSkills[currentCharName] || []).map((skill) => (
            <SkillItem
              key={skill.id}
              name={skill.name}
              progress={skill.progress}
              onProgressUpdate={(newProgress) =>
                handleProgressUpdate(skill.id, newProgress)
              }
              onMaster={() => handleProgressUpdate(skill.id, 100, true)}
              onDelete={() => handleDeleteSkill(skill.id)}
            />
          ))}
        </div>
      </div>

      {/* XP Section */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6 border border-cyan-200">
        <h2 className="text-2xl font-bold text-center text-cyan-700 mb-4">
          XP 
        </h2>

        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-800 font-semibold">
            Level: <span className="text-cyan-700">{level}</span>
          </div>
          <div className="text-gray-800 font-semibold">
            XP: <span className="text-cyan-700">{xp}/{nextLevelXP}</span>
          </div>
        </div>

        <div className="w-full bg-gray-200 h-6 rounded-full overflow-hidden mb-4">
          <div
            className="bg-yellow-400 h-6 transition-all duration-300"
            style={{ width: `${xpPercent}%` }}
          />
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => addXP(10)}
            className="px-4 py-2 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 transition"
          >
            +10 XP
          </button>
          <button
            onClick={() => addXP(25)}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition"
          >
            +25 XP
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
