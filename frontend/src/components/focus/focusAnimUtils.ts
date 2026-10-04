// Backdrop animation tiers keyed by minimum prayer level.
// Upload files to Firebase Storage at the paths listed below.
// Add more entries (in ascending level order) as new animations become available.
export const FOCUS_ANIMATION_TIERS: { minLevel: number; path: string }[] = [
    { minLevel: 1,  path: 'focus/animation.mp4'     }, // default
    { minLevel: 5,  path: 'focus/animation_l5.mp4'  },
    { minLevel: 10, path: 'focus/animation_l10.mp4' },
    { minLevel: 20, path: 'focus/animation_l20.mp4' },
];

/** Returns the Storage path for the highest tier the player has unlocked. */
export function focusAnimPath(prayerLevel: number): string {
    let path = FOCUS_ANIMATION_TIERS[0].path;
    for (const tier of FOCUS_ANIMATION_TIERS) {
        if (prayerLevel >= tier.minLevel) path = tier.path;
    }
    return path;
}
