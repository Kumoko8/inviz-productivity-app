import React, { useState } from "react";
import EditableName from "./EditableName";
import XPBar from "./XPBar";
import ProgressBar from "./ProgressBar";
import ImageArray from "./ImageArray";
import characters from "./CharacterData";

const LeftColumnContent: React.FC = () => {
  const [progress, setProgress] = useState(0); // Tracks current XP progress
  const [dots, setDots] = useState(0); // Tracks full XP bars (dots)
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    null
  );

  // Get selected character's data
  const selectedCharacterData = characters.find(
    (char) => char.name === selectedCharacter
  );

  // Update progress and dots when XP changes
  const onProgressChange = (newProgress: number, newDots: number) => {
    setProgress(newProgress);
    setDots(newDots);
  };

  // Dynamically calculate current image based on thresholds
  const getCharacterImage = () => {
    if (!selectedCharacterData) return null;
    const { thresholds, confirmedImages } = selectedCharacterData;
    for (let i = 0; i < thresholds.length; i++) {
      if (dots < thresholds[i]) {
        return confirmedImages[i];
      }
    }
    return confirmedImages[confirmedImages.length - 1] || "";
  };

  return (
    <div className="flex flex-col gap-2 bg-blue-100 p-4 border border-gray-300 rounded-lg">
      <div className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow">
        <EditableName />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow">
        <ProgressBar title="HP" maxProgress={100} initialProgress={100} />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow">
        <ImageArray
          baseImages={characters.map((char) => char.baseImages[0])}
          confirmedImages={selectedCharacterData?.confirmedImages || []}
          thresholds={selectedCharacterData?.thresholds || [100]}
          characterName={selectedCharacter || "Select a Character"}
          currentProgress={progress}
          confirmed={!!selectedCharacter}
          onCharacterSelect={setSelectedCharacter}
        />
      </div>

      {selectedCharacter && selectedCharacterData && (
        <>
          <div className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold">{selectedCharacter}</h3>
              <img
                src={getCharacterImage() || ""}
                alt={selectedCharacter}
                className="w-48 h-48 object-cover rounded-md"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow">
            <XPBar
              title="XP"
              initialLevel={dots}
              initialProgress={progress}
              maxProgress={100} // Single XP bar fills up to 100%
              thresholds={selectedCharacterData.thresholds || [100]}
              confirmedImages={selectedCharacterData.confirmedImages || []}
              onProgressChange={onProgressChange}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default LeftColumnContent;
