// src/types.ts

export interface User {
  id: string;
  email?: string;
}

export interface Skill {
  name: string;
  progress: number;   // 0–100 %
  mastered: boolean;
}

export interface Character {
  _id?: string;
  name: string;
  level: number;
  xp: number;
  userId?: string;     // owner (Realm user)
  skills: Skill[];     // embedded list of skills
}
