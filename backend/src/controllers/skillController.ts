import { Request, Response } from "express";
import Character from "../models/Character";
import { Types } from "mongoose";

// Add a new skill to a character
export const addSkill = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const charId = req.params.id;
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Skill name is required" });

    const character = await Character.findOne({ _id: charId, user: userId });
    if (!character) return res.status(404).json({ message: "Character not found" });

    // Prevent duplicate skill names
    if (character.skills.some(skill => skill.name === name)) {
      return res.status(400).json({ message: "Skill already exists" });
    }

    const newSkill = { _id: new Types.ObjectId(), name, progress: 0, mastered: false };
    character.skills.push(newSkill);
    await character.save();

    res.status(201).json(newSkill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete a skill
export const deleteSkill = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const charId = req.params.id;
    const skillId = req.params.skillId;

    const character = await Character.findOne({ _id: charId, user: userId });
    if (!character) return res.status(404).json({ message: "Character not found" });

    const skill = (character.skills as any).id(skillId);
    if (!skill) return res.status(404).json({ message: "Skill not found" });

    skill.remove(); // remove subdocument
    await character.save();

    res.json({ message: "Skill deleted", skills: character.skills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update skill progress
export const updateSkillProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const charId = req.params.id;
    const skillId = req.params.skillId;
    const { progress, mastered } = req.body;

    const character = await Character.findOne({ _id: charId, user: userId });
    if (!character) return res.status(404).json({ message: "Character not found" });


    const skill = (character.skills as any).id(skillId);
    if (!skill) return res.status(404).json({ message: "Skill not found" });

    // Update values if provided
    if (typeof progress === "number") skill.progress = progress;
    if (typeof mastered === "boolean") skill.mastered = mastered;

    await character.save();
    res.json(skill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
