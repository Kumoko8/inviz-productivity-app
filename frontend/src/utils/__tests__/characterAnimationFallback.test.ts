import { describe, expect, it } from "vitest";
import { needsCharacterAnimationFallback, withCharacterAnimationFallback } from "../characterAnimationFallback";
import type { CharacterAnimationFields } from "../../types/character";

const base: CharacterAnimationFields = {
  transformThresholds: [7, 12],
  transformAnimations: ["form"],
  transformTempAnimations: ["transition"],
  actionAnimations: ["action"],
  damageAnimations: ["damage"],
  defeatAnimations: ["defeat"],
  woundedAnimations: ["wounded"],
};

describe("character animation fallback", () => {
  it("fills each missing field without mutating either input", () => {
    const user = { name: "Hero", actionAnimations: ["custom"] };
    const result = withCharacterAnimationFallback(user, base);
    expect(result).toEqual({ ...base, ...user });
    expect(user).toEqual({ name: "Hero", actionAnimations: ["custom"] });
    expect(base.actionAnimations).toEqual(["action"]);
  });

  it("preserves empty arrays as explicit overrides", () => {
    const overrides = Object.fromEntries(Object.keys(base).map(key => [key, []])) as CharacterAnimationFields;
    expect(needsCharacterAnimationFallback(overrides)).toBe(false);
    expect(withCharacterAnimationFallback(overrides, base)).toEqual(overrides);
  });

  it("leaves missing fields untouched when the base also lacks them", () => {
    const user = { name: "Custom", actionAnimations: undefined };
    expect(needsCharacterAnimationFallback(user)).toBe(true);
    expect(withCharacterAnimationFallback(user, {})).toEqual(user);
  });
});
