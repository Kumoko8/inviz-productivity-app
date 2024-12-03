import React, { useState, useEffect } from "react";

interface XPBarProps {
    title: string;
    initialProgress: number;
    initialLevel: number;
    thresholds: number[];
    confirmedImages: string[];
    onProgressChange: (progress: number, level: number) => void;
}

const XPBar: React.FC<XPBarProps> = ({
    title,
    initialProgress,
    initialLevel,
    thresholds,
    onProgressChange,
}) => {
    const [progress, setProgress] = useState(initialProgress);
    const [level, setLevel] = useState(initialLevel);

    useEffect(() => {
        // Notify parent component of current progress and level
        onProgressChange(progress, level);
    }, [progress, level, onProgressChange]);

    const handleProgressChange = () => {
        if (progress + 10 >= 100) {
            // Reset bar and increment level
            setProgress(0);
            setLevel((prevLevel) => prevLevel + 1);
        } else {
            // Increment progress
            setProgress((prevProgress) => prevProgress + 10);
        }
    };

    return (
        <div className="xp-bar">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="relative w-full h-6 bg-gray-200 rounded-md overflow-hidden">
                <div
                    className="absolute top-0 left-0 h-full bg-green-500"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="flex justify-center gap-2 mt-2">
                {[...Array(level)].map((_, index) => (
                    <span
                        key={index}
                        className="w-4 h-4 bg-yellow-500 rounded-full"
                    ></span>
                ))}
            </div>
            <button
                onClick={handleProgressChange}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md"
            >
                Gain XP
            </button>
        </div>
    );
};

export default XPBar;
