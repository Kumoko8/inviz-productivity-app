import React, { useState } from "react";
import { FaStar } from "react-icons/fa";

interface ProgressBarWithInputProps {
    title: string;
  maxProgress: number; // The maximum progress value (100 represents a full bar)
  initialProgress?: number; // Optionally set the initial progress
}

const ProgressBarWithInput: React.FC<ProgressBarWithInputProps> = ({
  title,  
  maxProgress,
  initialProgress = 0,
}) => {
  const [progress, setProgress] = useState(initialProgress);
  const [inputValue, setInputValue] = useState<number | "">(""); // Input value can be a number or empty string

  const handleIncrement = () => {
    // Increment by the value in the input field
    if (typeof inputValue === "number" && inputValue > 0) {
      const newProgress = Math.min(progress + inputValue, maxProgress); // Ensure it doesn't exceed maxProgress
      setProgress(newProgress);
      setInputValue(""); // Clear the input after increment
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numeric input or empty
    if (/^\d*$/.test(value)) {
      setInputValue(value === "" ? "" : Number(value));
    }
  };

  return (
    <div className="flex flex-col items-center">
        {title}
      <div className="relative w-full max-w-xs h-6 bg-gray-200 rounded-full">
        <div
          className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
          style={{ width: `${(progress / maxProgress) * 100}%` }}
        ></div>
      </div>
      <div className="mt-4">
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          className="p-2 border border-gray-300 rounded-md text-center"
          placeholder="Enter value"
        />
        <button
          onClick={handleIncrement}
          className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
        >
          <FaStar />
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-700">{progress}%</p>
    </div>
  );
};

export default ProgressBarWithInput;
