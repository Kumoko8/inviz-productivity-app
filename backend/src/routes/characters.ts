import express from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import Character from "../models/Character";
import { addCharacter, deleteCharacter, getCharacters } from "../controllers/characterController";
import skillRoutes from "./skills"; // Import skill routes

const router = express.Router();

// Require auth for all character routes
router.use(authMiddleware);

/**
 * Get all characters for the logged-in user
 */
router.get("/", getCharacters);

/**
 * Add a new character
 */
router.post("/", addCharacter);

/**
 * Delete a character
 */
router.delete("/:id", deleteCharacter);

/**
 * Choose a premade character
 */
router.put("/:id/choose", addCharacter);

/**
 * Nested skill routes
 * URL format: /api/characters/:id/skills/...
 */
router.use("/:id/skills", skillRoutes);

export default router;
