import { findCharacter } from './pixelRegistry';

export type CompanionAbility = 'bugs' | 'unicorns' | 'birds' | 'animals' | 'story';

// Tuning knobs for Training Mode companion abilities.
export const ABILITY_CONFIG = {
  bugWrongDamage: 5,         // HP lost per wrong answer (normally 10)
  unicornRetryChance: 0.3,   // chance a wrong answer gets a second try instead of costing HP
  birdDoubleChance: 0.3,     // chance a correct answer deals double damage
  animalXpMultiplier: 2,
  storyReviveHp: 50,         // HP restored the first time a character hits 0
} as const;

// Pixel groups are admin-created, so match on the group id; "story" tolerates a plural id.
const GROUP_TO_ABILITY: Record<string, CompanionAbility> = {
  bugs: 'bugs',
  unicorns: 'unicorns',
  birds: 'birds',
  animals: 'animals',
  story: 'story',
  stories: 'story',
};

export const abilityForCompanion = (companionId?: string): CompanionAbility | null => {
  if (!companionId) return null;
  const group = findCharacter(companionId)?.group?.toLowerCase();
  return (group && GROUP_TO_ABILITY[group]) || null;
};

export const ABILITY_LABELS: Record<CompanionAbility, string> = {
  bugs: 'Bug',
  unicorns: 'Unicorn',
  birds: 'Bird',
  animals: 'Animal',
  story: 'Story Character',
};
