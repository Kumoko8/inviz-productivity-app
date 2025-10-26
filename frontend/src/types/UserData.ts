export interface Skill {
  name: string;
  progress: number;
  mastered: boolean;
}

export interface CharacterProgress {
  name: string;
  level: number;
  xp: number;
}

export interface UserData {
  xp: number;
  skills: Skill[];
  characters: CharacterProgress[];
}
