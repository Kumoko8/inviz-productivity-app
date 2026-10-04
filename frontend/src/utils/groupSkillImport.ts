const normalizedSkillName = (skill: any): string =>
  typeof skill?.name === 'string' ? skill.name.trim().toLowerCase() : '';

const newImportedId = (): string =>
  `group-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const cloneSkillTree = (skill: any): any => ({
  ...skill,
  id: newImportedId(),
  progress: 0,
  mastered: false,
  ...(Array.isArray(skill.subskills)
    ? { subskills: skill.subskills.map(cloneSkillTree) }
    : {}),
});

export const getCommonGroupSkills = (characters: any[]): any[] => {
  if (characters.length === 0) return [];

  const [firstCharacter, ...otherCharacters] = characters;
  const commonNames = new Set(
    (Array.isArray(firstCharacter.skills) ? firstCharacter.skills : [])
      .map(normalizedSkillName)
      .filter(Boolean)
  );

  for (const character of otherCharacters) {
    const names = new Set(
      (Array.isArray(character.skills) ? character.skills : [])
        .map(normalizedSkillName)
        .filter(Boolean)
    );
    for (const name of commonNames) {
      if (!names.has(name)) commonNames.delete(name);
    }
  }

  const seen = new Set<string>();
  return (Array.isArray(firstCharacter.skills) ? firstCharacter.skills : []).filter((skill: any) => {
    const name = normalizedSkillName(skill);
    if (!name || !commonNames.has(name) || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

export const getMissingGroupSkills = (character: any, commonSkills: any[]): any[] => {
  const existingNames = new Set(
    (Array.isArray(character.skills) ? character.skills : [])
      .map(normalizedSkillName)
      .filter(Boolean)
  );

  return commonSkills.filter((skill: any) => {
    const name = normalizedSkillName(skill);
    if (!name || existingNames.has(name)) return false;
    existingNames.add(name);
    return true;
  });
};

export const importMissingGroupSkills = (character: any, commonSkills: any[]): any => {
  const missingSkills = getMissingGroupSkills(character, commonSkills);
  if (missingSkills.length === 0) return character;

  return {
    ...character,
    skills: [
      ...(Array.isArray(character.skills) ? character.skills : []),
      ...missingSkills.map(cloneSkillTree),
    ],
  };
};
