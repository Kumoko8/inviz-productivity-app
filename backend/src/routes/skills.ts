import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import {
  addSkill,
  deleteSkill,
  updateSkillProgress,
} from "../controllers/skillController";

const router = express.Router({ mergeParams: true }); // mergeParams lets us access :characterId

// Add a skill to a character
router.post("/", addSkill);

// Delete a skill from a character
router.delete("/:skillId", deleteSkill);

// Update a skill (like progress or mastered)
router.put("/:skillId", updateSkillProgress);

export default router;
