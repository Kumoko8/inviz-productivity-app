import React, { useState } from "react";
import SkillItem from "./SkillItem";

interface Skill {
  name: string;
  progress: number;
  mastered: boolean;
}

const SkillTracker: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([
    { name: "Algebra", progress: 50, mastered: false },
    { name: "3D forms", progress: 50, mastered: false },
  ]);

  const handleProgressUpdate = (skillName: string, newProgress: number) => {
    setSkills(prev =>
      prev.map(skill =>
        skill.name === skillName
          ? { ...skill, progress: newProgress }
          : skill
      )
    );
  };

  const handleMarkMastered = (skillName: string) => {
    setSkills(prev =>
      prev.map(skill =>
        skill.name === skillName ? { ...skill, mastered: true } : skill
      )
    );
  };

  const handleAddSkill = () => {
    const name = prompt("Enter new skill name:");
    if (name && !skills.some(skill => skill.name === name)) {
      setSkills(prev => [...prev, { name, progress: 0, mastered: false }]);
    }
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
        {skills.map(skill =>
          !skill.mastered ? (
            <SkillItem
              key={skill.name}
              name={skill.name}
              progress={skill.progress}
              onProgressUpdate={newProgress =>
                handleProgressUpdate(skill.name, newProgress)
              }
              onMaster={() => handleMarkMastered(skill.name)}
            />
          ) : null
        )}
      </div>
      {skills.some(skill => skill.mastered) && (
  <div className="mt-6">
    <h3 className="text-md font-bold mb-2">Mastered Skills</h3>
    <ul className="list-disc list-inside">
      {skills
        .filter(skill => skill.mastered)
        .map(skill => (
          <li key={skill.name} className="text-green-700 font-medium">
            {skill.name}
          </li>
        ))}
    </ul>
  </div>
)}
    </div>
  );
};

export default SkillTracker;
