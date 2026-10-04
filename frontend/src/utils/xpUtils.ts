/**
 * XP progression utilities.
 *
 * Progression curve: XP required to advance from level N to N+1 = N³
 * Cumulative XP at the start of level L = sum of cubes 1³ + 2³ + ... + (L-1)³
 *                                        = [(L-1) × L / 2]²  (sum-of-cubes identity)
 */

/** XP required to advance from `level` to the next level. */
export const xpThreshold = (level: number): number => level ** 3;

/** Total (cumulative) XP a character has earned by having `xp` progress at `level`. */
export const totalXpForLevel = (level: number, xp: number): number => {
    const n = Math.max(0, level - 1);
    return Math.pow((n * (n + 1)) / 2, 2) + (xp || 0);
};

/** Convert a total XP value back into { level, xp }. */
export const totalToLevelXp = (total: number): { level: number; xp: number } => {
    let level = 1;
    while (true) {
        if (total < totalXpForLevel(level + 1, 0)) break;
        level++;
        if (level > 10000) break;
    }
    const xp = Math.max(0, Math.floor(total - totalXpForLevel(level, 0)));
    return { level, xp };
};

/**
 * Prayer Points required to advance from prayer level `n` to n+1.
 * Formula: (4n³) / 5
 */
export const prayerPointsThreshold = (n: number): number =>
    Math.round((4 * n ** 3) / 5);
