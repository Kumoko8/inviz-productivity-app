import React, { useState } from "react";
import characters from "./CharacterData"; // Import character data

interface ImageArrayProps {
  currentProgress: number; // Current progress to determine the image
  confirmed: boolean; // Whether the selection has been confirmed
  onCharacterSelect: (name: string) => void; // Callback to notify parent of selected character
}

const ImageArray: React.FC<ImageArrayProps> = ({
  currentProgress,
  confirmed,
  onCharacterSelect,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Function to determine image index based on current progress
  const getImageIndex = (progress: number, thresholds: number[]) => {
    for (let i = 0; i < thresholds.length; i++) {
      if (progress < thresholds[i]) {
        return i;
      }
    }
    return thresholds.length - 1; // Return last index if progress exceeds all thresholds
  };

  const handleImageClick = (image: string, name: string) => {
    if (!confirmed) {
      setSelectedImage(image); // Set selected image before confirmation
      setSelectedName(name); // Set selected name
      onCharacterSelect(name); // Notify parent about character selection
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {!confirmed && (
        <h2 className="text-xl font-bold mb-4">Choose Your Character</h2>
      )}

      {!confirmed ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {characters.map((char) => (
            <div
              key={char.name}
              className="flex flex-col items-center w-32 h-32 border border-gray-300 rounded-md overflow-hidden cursor-pointer transform hover:scale-110 transition duration-300"
              onClick={() => handleImageClick(char.baseImages[0], char.name)}
            >
              <img
                src={char.baseImages[0]}
                alt={char.name}
                className="w-full h-full object-cover"
              />
              <p className="mt-2 text-sm">{char.name}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h3 className="text-lg font-bold">{selectedName}</h3>
          {selectedName && (
            <div className="relative w-48 h-48 border border-gray-300 rounded-md overflow-hidden">
              <img
                src={
                  selectedImage ||
                  characters
                    .find((char) => char.name === selectedName)
                    ?.confirmedImages[
                      getImageIndex(
                        currentProgress,
                        characters.find((char) => char.name === selectedName)
                          ?.thresholds || []
                      )
                    ]
                }
                alt={selectedName || "Selected Character"}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageArray;
