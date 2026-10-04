type CharacterPickerSections = {
    ungroupedCharacters: any[];
    groupedCharacters: { group: string; characters: any[] }[];
};

export const getCharacterPickerSections = (userCharacters: Record<string, any>): CharacterPickerSections => {
    const characters = Object.values(userCharacters);
    const groups = Array.from(new Set(characters
        .map((character: any) => character.characterGroup?.trim())
        .filter(Boolean))) as string[];
    const getCharacterLabel = (character: any) => character.playerName?.trim() || character.name || '';
    const sortCharacters = (items: any[]) => items.sort((a, b) =>
        getCharacterLabel(a).localeCompare(getCharacterLabel(b), undefined, { sensitivity: 'base' })
    );

    return {
        ungroupedCharacters: sortCharacters(characters.filter((character: any) => !character.characterGroup?.trim())),
        groupedCharacters: groups.map(group => ({
            group,
            characters: sortCharacters(characters.filter((character: any) => character.characterGroup?.trim() === group)),
        })),
    };
};

export const getCharactersInPickerOrder = (userCharacters: Record<string, any>): any[] => {
    const { ungroupedCharacters, groupedCharacters } = getCharacterPickerSections(userCharacters);
    return [...ungroupedCharacters, ...groupedCharacters.flatMap(({ characters }) => characters)];
};