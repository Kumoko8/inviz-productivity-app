export const RARITY_COUNTS = {
  common: 50,
  uncommon: 20,
  rare: 6,
  special: 1,
  // Miraculous characters are never dropped from chests (transform-only).
  miraculous: 0,
} as const;

export const PIXEL_RARITY_ORDER = ['common', 'uncommon', 'rare', 'special', 'miraculous'] as const;

export type PixelCharacterRarity = (typeof PIXEL_RARITY_ORDER)[number];

export const PIXEL_CHARACTER_GROUPS = {
  bugs: 'Bugs',
  unicorns: 'Unicorns',
  birds: 'Birds',
} as const;

export type PixelCharacterGroup = keyof typeof PIXEL_CHARACTER_GROUPS;

// A character's visual is resolved at render time via `<PixelSprite id={...} />`,
// which loads pre-rendered frames from Firebase Storage at `pixelCharacters/{id}/frame_N.png`.
type PixelCharacter = {
  id: string;
  name: string;
  group: PixelCharacterGroup;
  rarity: PixelCharacterRarity;
};

export const CHARACTER_POOL: PixelCharacter[] = [
  { id: 'bee', name: 'Honey Bee', group: 'bugs', rarity: 'common' },
  { id: 'mallard-duck', name: 'Mallard Duck', group: 'birds', rarity: 'common' },
  { id: 'shoveler-duck', name: 'Shoveler Duck', group: 'birds', rarity: 'common' },
  { id: 'peking-duck', name: 'Pekin Duck', group: 'birds', rarity: 'common' },
  { id: 'muscovy-duck', name: 'Muscovy Duck', group: 'birds', rarity: 'common' },
  { id: 'unicorn', name: 'Unicorn', group: 'unicorns', rarity: 'common' },
  { id: 'sun', name: 'Sun Unicorn', group: 'unicorns', rarity: 'common' },
  { id: 'moon', name: 'Moon Unicorn', group: 'unicorns', rarity: 'common' },

  { id: 'blue-bee', name: 'Blue Carpenter Bee', group: 'bugs', rarity: 'uncommon' },
  { id: 'green-weaver-ant', name: 'Green Weaver Ant', group: 'bugs', rarity: 'common' },
  { id: 'bumble-bee', name: 'Bumble Bee', group: 'bugs', rarity: 'uncommon' },
  { id: 'leaf-cutter-bee', name: 'Leaf Cutter Bee', group: 'bugs', rarity: 'uncommon' },
  { id: 'monarch-butterfly', name: 'Monarch Butterfly', group: 'bugs', rarity: 'uncommon' },
  { id: 'queen-bee', name: 'Queen Bee', group: 'bugs', rarity: 'uncommon' },
  { id: 'queen-bumble-bee', name: 'Queen Bumble Bee', group: 'bugs', rarity: 'rare' },
  { id: 'blue-queen-bee', name: 'Blue Queen Bee', group: 'bugs', rarity: 'rare' },
  { id: 'chocolate-unicorn', name: 'Chocolate Unicorn', group: 'unicorns', rarity: 'uncommon' },
  { id: 'vanilla-unicorn', name: 'Vanilla Unicorn', group: 'unicorns', rarity: 'uncommon' },
  { id: 'rubber-ducky', name: 'Rubber Ducky', group: 'birds', rarity: 'uncommon' },

  { id: 'forest-unicorn', name: 'Forest Unicorn', group: 'unicorns', rarity: 'rare' },
  { id: 'ice-unicorn', name: 'Ice Unicorn', group: 'unicorns', rarity: 'rare' },

  { id: 'wing-unicorn', name: 'Wing Unicorn', group: 'unicorns', rarity: 'special' },
  { id: 'rainbow-unicorn', name: 'Rainbow Unicorn', group: 'unicorns', rarity: 'special' },
  { id: 'rainbow-wing-unicorn', name: 'Rainbow Wing Unicorn', group: 'unicorns', rarity: 'miraculous' },
  { id: 'blue-velvet-ant', name: 'Blue Velvet Ant', group: 'bugs', rarity: 'common' },
  { id: 'red-harvester-ant', name: 'Red Harvester Ant', group: 'bugs', rarity: 'common' },
  { id: 'black-carpenter-ant', name: 'Black Carpenter Ant', group: 'bugs', rarity: 'common' },
  { id: 'fire-ant', name: 'Fire Ant', group: 'bugs', rarity: 'common' },
  { id: 'queen-black-ant', name: 'Queen Black Ant', group: 'bugs', rarity: 'uncommon' },
  { id: 'star-unicorn', name: 'Star Unicorn', group: 'unicorns', rarity: 'rare' },
];

// New pixel characters can be added purely by uploading art — no code required:
// 1. Upload PNG frames to Storage at `pixelCharacters/{id}/frame_0.png`, `frame_1.png`, ... (one frame is fine for a static sprite).
// 2. Add a `{ id, name, group, rarity }` entry above with a matching `id`.

export const buildWeightedPool = (poolIds?: string[]) => {
  const pool: string[] = [];
  for (const c of CHARACTER_POOL) {
    if (poolIds && poolIds.length > 0 && !poolIds.includes(c.id)) continue;
    const count = RARITY_COUNTS[c.rarity] || 1;
    for (let i = 0; i < count; i++) pool.push(c.id);
  }
  return pool;
};

export const findCharacter = (id: string) => CHARACTER_POOL.find(c => c.id === id) || null;

export const nextPixelRarity = (rarity: PixelCharacterRarity): PixelCharacterRarity | null => {
  const next = PIXEL_RARITY_ORDER.indexOf(rarity) + 1;
  return PIXEL_RARITY_ORDER[next] ?? null;
};

export const findPixelTransformTargets = (
  character: PixelCharacter,
  owned?: Record<string, number>
): PixelCharacter[] => {
  const nextRarity = nextPixelRarity(character.rarity);
  if (!nextRarity) return [];
  const candidates = CHARACTER_POOL.filter(candidate => candidate.group === character.group && candidate.rarity === nextRarity);
  // Miraculous characters are unique: only offer ones the user doesn't own yet.
  if (nextRarity === 'miraculous') {
    return candidates.filter(candidate => (owned?.[candidate.id] ?? 0) <= 0);
  }
  return candidates;
};

export default { CHARACTER_POOL, RARITY_COUNTS, buildWeightedPool, findCharacter };
