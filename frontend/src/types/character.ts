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
  color?: string;
  notes?: string;
  subskills?: Subskill[];
  completedAt?: number;
  xpClaimedAt?: number;
  createdAt?: number;
  type?: string; // e.g., 'level'
  levelCount?: number; // for level-type skills
  // amount-based skill fields
  amountTarget?: number;
  amountValue?: number;
}

// export interface ArchivedSkill {
//   id: string;
//   name: string;
//   completedAt: number; // epoch ms
//   originalSkillId?: string;
//   subskills?: Subskill[];
//   createdAt?: number;
// }

export interface SkillItemProps {
  name: string;
  notes?: string;
  progress: number;
  onProgressUpdate: (newProgress: number, extra?: any) => void;
  onMaster: () => void;
  onDelete: () => void;
  disabled?: boolean;
  onRename?: (newName: string) => void;
  subskills?: Subskill[];
  onAddSubskill?: (name: string) => void;
  onUpdateSubskill?: (subskillId: string, updates: Partial<Subskill>) => void;
  onDeleteSubskill?: (subskillId: string) => void;
  // onArchive?: () => void;
  onPrioritize?: () => void;
  onColorChange?: (color: string) => void;
  color?: string;
  onSaveNote?: (note: string) => void;
  onDuplicate?: () => void;
  onLevelUp?: () => void;
  type?: string;
  uid?: string | null;
  xpClaimedAt?: number;
  characterXp?: number;
  characterLevel?: number;
  onCompleteSkill?: (xp: number) => void;
  levelCount?: number;
  elementId?: string;
  onOpenMobile?: () => void;
  amountTarget?: number;
  amountValue?: number;
  createdAt?: number;
  onAwardXp?: (xp: number) => void;
}

export interface Subskill {
  id: string;
  name: string;
  progress?: number;
  mastered?: boolean;
  levelCount?: number;
  type?: string;
}

export interface Character {
  id: string;
  name: string;
  playerName?: string;
  defaultAnimation?: string;
  animation?: string;
  xp: number;
  level: number;
  hp: number;
  maxHp: number;
  createdAt?: number | Date;
  storePrices?: Record<string, number>;
  transformThresholds?: number[];
  transformAnimations?: string[];
  transformTempAnimations?: string[];
  transformIndex?: number; // how many transforms already applied for this user
  actionAnimations?: string[]; // per-form action (attack) animation Storage paths
  damageAnimations?: string[]; // per-form damage (hurt) animation Storage paths
  defeatAnimations?: string[]; // per-form defeat animation Storage paths
  woundedAnimations?: string[]; // per-form wounded (HP ≤ 50%) animation Storage paths
  pixelCharacters?: Record<string, number>;

}

export interface BaseCharacterFirestore {
  id?: string;
  name?: string;
  defaultAnimation?: string;
  animation?: string;
  hp?: number;
  maxHp?: number;
  transformThresholds?: number[];
  transformAnimations?: string[];
  transformTempAnimations?: string[];
  actionAnimations?: string[]; // per-form action animation Storage paths
  damageAnimations?: string[]; // per-form damage animation Storage paths
  defeatAnimations?: string[]; // per-form defeat animation Storage paths
  woundedAnimations?: string[]; // per-form wounded animation Storage paths
}

export interface UserCharacterDataFirestore {
  id?: string;
  xp?: number;
  level?: number;
  hp?: number;
  maxHp?: number;
  createdAt?: number | Date;
  // archivedSkills?: ArchivedSkill[];
  playerName?: string; // optional per-user display name (e.g., student's name)
  characterGroup?: string; // optional user-defined group for dashboard and Class Mode organization
  notes?: string; // per-character notes stored on the character doc
  pixelCharacters?: Record<string, number>;
}

export interface Prayer {
  id: string;
  text: string;
  color: string;
  createdAt?: number;
  updatedAt?: number;
}


