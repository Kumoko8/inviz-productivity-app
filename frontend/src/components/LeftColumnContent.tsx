import React from "react";
import './EditableName';
import EditableName from "./EditableName";
import ProgressBar from "./ProgressBar";
import ImageArray from "./ImageArray";
import ProgressBarWithInput from "./ProgressBarWithInput";
import Kumo from '../assets/K_umo.jpg';
import Kiiro from '../assets/kiiro copy.jpg';
import Maguro from '../assets/maguro.jpg';

const LeftColumnContent: React.FC = () => {
  const rows = [
    <EditableName />,
    <ProgressBar title={'HP'} maxProgress={100} />,
    <ProgressBarWithInput title={'XP'} maxProgress={100} />,
    <ImageArray images={[Kumo, Kiiro, Maguro]} />,
    "Row 5",
    "Row 6"
  ];

  return (
    <div className="flex flex-col gap-2 bg-blue-100 p-4 border border-gray-300 rounded-lg">
      {rows.map((row, index) => (
        <div
          key={index}
          className="bg-white border border-gray-200 rounded-md p-2 text-center flex-grow"
        >
          {row}
        </div>
      ))}
    </div>
  );
};

export default LeftColumnContent;


