import React from "react";
import './EditableName';
import EditableName from "./EditableName";
import ProgressBar from "./ProgressBar";
import ProgressBarWithInput from "./ProgressBarWithInput";

const LeftColumnContent: React.FC = () => {
    const rows = [
        <EditableName />, <ProgressBar title={'HP'}maxProgress={100} />, <ProgressBarWithInput title={'XP'} maxProgress={100}/>, "Row 4", "Row 5", "Row 6"];
  return (
    <div className="grid grid-rows-6 gap-2 bg-blue-100 p-4 border border-gray-300 rounded-lg">
      {rows.map((row, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-md p-2 text-center"
        >
          {row}
        </div>
      ))}
    </div>
  );
};

export default LeftColumnContent;

