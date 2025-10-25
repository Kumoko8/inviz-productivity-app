import React, { useState } from "react";
import SkillItem from "./SkillItem";

interface Skill {
  id: string;
  name: string;
  progress: number;
  mastered: boolean;
}

interface SkillTrackerProps {
  characterId: string;
}

const SkillTracker: React.FC<SkillTrackerProps> = ({ characterId }) => {
  const [skills, setSkills] = useState<Skill[]>([]);

  // Add new skill
  const handleAddSkill = () => {
    const name = prompt("Enter a new skill:");
    if (!name) return;

    const newSkill: Skill = {
      id: Date.now().toString(),
      name,
      progress: 0,
      mastered: false,
    };

    setSkills((prev) => [...prev, newSkill]);
  };

  // Update skill progress or mastery
  const handleProgressUpdate = (
    skillId: string,
    newProgress: number,
    mastered = false
  ) => {
    setSkills((prev) =>
      prev.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              progress: newProgress,
              mastered,
            }
          : skill
      )
    );
  };

  // Delete skill
  const handleDeleteSkill = (skillId: string) => {
    if (!confirm("Are you sure you want to delete this skill?")) return;
    setSkills((prev) => prev.filter((s) => s.id !== skillId));
  };

  return (
    <div className="p-4 bg-gray-100 rounded-md">
      <h2 className="text-lg font-bold mb-4">Skill Tracker</h2>

      <button
        onClick={handleAddSkill}
        className="mb-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        + Add Skill
      </button>

      <div className="flex flex-col gap-4">
        {skills.map((skill) => (
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
  );
};

export default SkillTracker;
