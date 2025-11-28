// src/types/character.ts

export interface User {
  id: string;
  email?: string;
}

export interface Skill {
  id: string;
  name: string;
  progress: number;
  mastered: boolean;
}

export interface SkillItemProps {
  name: string;
  progress: number;
  onProgressUpdate: (newProgress: number) => void;
  onMaster: () => void;
  onDelete: () => void;
}

export interface Character {
  id: string;
  name: string;
  defaultAnimation?: string;
  animation?: string;
  hp: number;
  maxHp: number;

}

export interface BaseCharacterFirestore {
  id?: string;
  name?: string;
  defaultAnimation?: string;
  animation?: string;
  hp?: number;
  maxHp?: number;
}

export interface UserCharacterDataFirestore {
  id?: string;
  xp?: number;
  level?: number;
  hp?: number;
  maxHp?: number;
  createdAt?: number | Date;
}

export interface Prayer {
  id: string;
  text: string;
  color: string;
}


