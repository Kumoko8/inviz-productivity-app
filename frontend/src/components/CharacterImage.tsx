import React from "react";

interface CharacterImageProps {
  characterName: string;
  characterImage: string;
}

const CharacterImage: React.FC<CharacterImageProps> = ({ characterName, characterImage }) => {
  return (
    <div className="character-image">
      <h2>{characterName}</h2>
      <img src={characterImage} alt={characterName} />
    </div>
  );
};

export default CharacterImage;
