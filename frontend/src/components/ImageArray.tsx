import React, { useState } from "react";

interface ImageArrayProps {
  images: string[]; // Array of image URLs
}

const ImageArray: React.FC<ImageArrayProps> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageClick = (src: string) => {
    setSelectedImage(src); // Set the clicked image as the selected image
  };

  const handleBackToGrid = () => {
    setSelectedImage(null); // Reset the selected image to show all images
  };

  return (
    <div className="w-full h-64 border border-gray-300 rounded-lg  p-2">
      {selectedImage ? (
        // Display the selected image only
        <div className="w-full h-full flex justify-center items-center flex-col">
          <img
            src={selectedImage}
            alt="Selected Character"
            className="object-cover w-full h-full rounded-md"
          />
          <button
            onClick={handleBackToGrid}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Back
          </button>
        </div>
      ) : (
        // Display all images in a grid before any selection
        <div className="grid grid-cols-3 gap-2 h-full">
          {images.map((src, index) => (
            <div
              key={index}
              className="relative w-full h-full cursor-pointer"
              onClick={() => handleImageClick(src)} // Click to select image
            >
              <img
                src={src}
                alt={`Character ${index}`}
                className="object-cover w-full h-full rounded-md"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageArray;

