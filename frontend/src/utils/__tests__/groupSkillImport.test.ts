import { describe, expect, it } from 'vitest';
import { getCommonGroupSkills, importMissingGroupSkills } from '../groupSkillImport';

describe('group skill import', () => {
    it('imports only common missing skill names with fresh nested IDs', () => {
        const groupCharacters = [
            {
                skills: [
                    { id: 'math-a', name: 'Math', subskills: [{ id: 'addition-a', name: 'Addition' }] },
                    { id: 'reading-a', name: 'Reading' },
                    { id: 'science-a', name: 'Science' },
                    { id: 'writing-a', name: 'Writing', progress: 75, mastered: true, subskills: [{ id: 'essay-a', name: 'Essay', progress: 50, mastered: true }] },
                ],
            },
            {
                skills: [
                    { id: 'math-b', name: ' math ' },
                    { id: 'reading-b', name: 'Reading' },
                    { id: 'writing-b', name: 'Writing' },
                ],
            },
        ];
        const commonSkills = getCommonGroupSkills(groupCharacters);
        const character = {
            id: 'new-character',
            skills: [{ id: 'own-math', name: 'MATH' }, { id: 'own-art', name: 'Art' }],
        };

        const imported = importMissingGroupSkills(character, commonSkills);

        expect(imported.skills.map((skill: any) => skill.name)).toEqual(['MATH', 'Art', 'Reading', 'Writing']);
        expect(imported.skills[3].id).not.toBe('writing-a');
        expect(imported.skills[3].subskills[0].id).not.toBe('essay-a');
        expect(imported.skills[3].progress).toBe(0);
        expect(imported.skills[3].mastered).toBe(false);
        expect(imported.skills[3].subskills[0].progress).toBe(0);
        expect(imported.skills[3].subskills[0].mastered).toBe(false);
        expect(character.skills).toHaveLength(2);
    });
});
