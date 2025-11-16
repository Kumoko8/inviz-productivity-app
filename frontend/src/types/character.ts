// src/types.ts

export interface User {
  id: string;
  email?: string;
}

export interface Skill {
  _id: string;
  name: string;
  progress: number;   // 0–100 %
  mastered: boolean;
}

export interface Character {
    id: string;
    name: string;
    defaultAnimation?: string;
    animation?: string;

}
