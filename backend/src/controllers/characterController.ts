import { Request, Response } from "express";
import Character from "../models/Character";

// Get characters for logged-in user
export const getCharacters = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const characters = await Character.find({ user: userId });
    res.json(characters);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const addCharacter = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { type } = req.body; // premade character type

    const newCharacter = new Character({ user: userId, type });
    await newCharacter.save();

    res.status(201).json(newCharacter);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteCharacter = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const charId = req.params.id;

    const deleted = await Character.findOneAndDelete({ _id: charId, user: userId });
    if (!deleted) return res.status(404).json({ message: "Character not found" });

    res.json({ message: "Character deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
