import type { CharacterAnimationFields } from "../types/character";

const ANIMATION_FIELDS = [
  "transformThresholds",
  "transformAnimations",
  "transformTempAnimations",
  "actionAnimations",
  "damageAnimations",
  "defeatAnimations",
  "woundedAnimations",
] as const satisfies readonly (keyof CharacterAnimationFields)[];

export function needsCharacterAnimationFallback(character: CharacterAnimationFields): boolean {
  return ANIMATION_FIELDS.some(field => !character[field]);
}

export function withCharacterAnimationFallback<T extends CharacterAnimationFields>(
  character: T,
  base: CharacterAnimationFields,
): T {
  const result = { ...character };
  for (const field of ANIMATION_FIELDS) {
    if (!result[field] && base[field]) {
      Object.assign(result, { [field]: base[field] });
    }
  }
  return result;
}
