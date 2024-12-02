import React from "react";

interface MainFormProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}

const MainForm: React.FC<MainFormProps> = ({
  leftContent,
  rightContent,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-4">
      <div className="bg-blue-100 p-4 rounded-md shadow-md">
        {leftContent}
      </div>
      <div className="bg-yellow-100 p-4 rounded-md shadow-md">
        {rightContent}
      </div>
    </div>
  );
};

export default MainForm;
