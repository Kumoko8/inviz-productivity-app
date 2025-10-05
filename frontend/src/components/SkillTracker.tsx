import React, { useEffect, useState } from "react";
import SkillItem from "./SkillItem";
import {
  getSkills,
  addSkill,
  updateSkill,
  deleteSkill,
} from "../services/api";

interface Skill {
  _id: string;
  name: string;
  progress: number;
  mastered: boolean;
}

interface SkillTrackerProps {
  characterId: string; // we’ll pass this from the character context or prop
}

const SkillTracker: React.FC<SkillTrackerProps> = ({ characterId }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  // Load skills from backend
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const data = await getSkills(characterId);
        setSkills(data);
      } catch (err) {
        console.error("Failed to load skills:", err);
      } finally {
        setLoading(false);
      }
    };

    if (characterId) fetchSkills();
  }, [characterId]);

  // Add new skill
  const handleAddSkill = async () => {
    const name = prompt("Enter a new skill:");
    if (!name) return;

    try {
      const newSkill = await addSkill(characterId, name);
      setSkills((prev) => [...prev, newSkill]);
    } catch (err) {
      console.error("Error adding skill:", err);
    }
  };

  // Update skill progress or mastered status
  const handleProgressUpdate = async (
    skillId: string,
    newProgress: number,
    mastered = false
  ) => {
    try {
      const updatedSkill = await updateSkill(
        characterId,
        skillId,
        newProgress,
        mastered
      );
      setSkills((prev) =>
        prev.map((s) => (s._id === skillId ? updatedSkill : s))
      );
    } catch (err) {
      console.error("Error updating skill:", err);
    }
  };

  // Delete skill
  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm("Are you sure you want to delete this skill?")) return;
    try {
      await deleteSkill(characterId, skillId);
      setSkills((prev) => prev.filter((s) => s._id !== skillId));
    } catch (err) {
      console.error("Error deleting skill:", err);
    }
  };

  if (loading) return <p>Loading skills...</p>;

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
            key={skill._id}
            name={skill.name}
            progress={skill.progress}
            onProgressUpdate={(newProgress) =>
              handleProgressUpdate(skill._id, newProgress)
            }
            onMaster={() => handleProgressUpdate(skill._id, 100, true)}
            onDelete={() => handleDeleteSkill(skill._id)}
          />
        ))}
      </div>
    </div>
  );
};

export default SkillTracker;
