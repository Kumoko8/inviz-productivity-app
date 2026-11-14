import { describe, expect, it } from 'vitest';
import { characterData } from '../CharacterData';

describe('base character animation paths', () => {
    it('uses the migrated folders for every available idle and transformation animation', () => {
        const available: Record<string, { idle: number; transformations: number }> = {
            Kumo: { idle: 2, transformations: 1 },
            Kiiro: { idle: 2, transformations: 1 },
            Maguro: { idle: 3, transformations: 2 },
            Yumi: { idle: 2, transformations: 1 },
            Mushi: { idle: 4, transformations: 3 },
            Roku: { idle: 2, transformations: 1 },
        };
        for (const [name, counts] of Object.entries(available)) {
            const character = characterData.find(entry => entry.name === name);
            if (!character) throw new Error(`Missing base character ${name}`);
            const lower = name.toLowerCase();
            const idle = [character.animation, ...(character.transformAnimations ?? [])];
            for (let i = 0; i < counts.idle; i++) {
                expect(idle[i]).toBe(`characters/${lower}/idle/${lower}_${i + 1}.mp4`);
            }
            for (let i = 0; i < counts.transformations; i++) {
                expect(character.transformTempAnimations?.[i]).toBe(
                    `characters/${lower}/transformations/${lower}_transform_temp_${i + 1}.mp4`,
                );
            }
        }
    });
});
