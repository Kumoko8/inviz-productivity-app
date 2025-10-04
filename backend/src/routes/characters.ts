import { Router } from "express";
import Character from "../models/Character";

const router = Router();

// Create new character
router.post("/", async (req, res) => {
  try {
    const { userId, name } = req.body;
    const character = new Character({ userId, name, skills: [] });
    await character.save();
    res.status(201).json(character);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add skill to character
router.post("/:id/skills", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const character = await Character.findById(id);
    if (!character) return res.status(404).json({ message: "Character not found" });

    character.skills.push({ name, mastered: false });
    await character.save();
    res.json(character);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
