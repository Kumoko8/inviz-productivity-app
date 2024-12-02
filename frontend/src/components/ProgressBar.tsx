import React, { useState } from "react";

interface ProgressBarProps {
  title: string;  
  maxProgress: number; // The maximum progress value (100 represents a full bar)
  initialProgress?: number; // Optionally set the initial progress
}

const ProgressBar: React.FC<ProgressBarProps> = ({ title, maxProgress, initialProgress = 0 }) => {
  const [progress, setProgress] = useState(initialProgress);

  const handleIncrement = () => {
    if (progress < maxProgress) {
      setProgress(progress + 10); 
    }
  };
  const handleDecrement = () => {
    if (progress > 0) {
      setProgress(progress - 10); 
    }
  };

  return (
    <div className="flex flex-col items-center">
       {title}
      <div className="relative w-full max-w-xs h-6 bg-gray-200 rounded-full">
        <div
          className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
          style={{ width: `${(progress / maxProgress) * 100}%` }}
        ></div>
      </div>
      <div className="mt-4 flex space-x-4"> {/* Flex container for side-by-side buttons */}

      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        onClick={handleIncrement}
        disabled={progress >= maxProgress}
      >
        +
      </button>
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        onClick={handleDecrement}
        
      >
        -
      </button>
      </div>
      <p className="mt-2 text-sm text-gray-700">{progress}%</p>
    </div>
  );
};

export default ProgressBar;
