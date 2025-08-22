import React, { useState } from "react";

const EditableName: React.FC = () => {
  const [name, setName] = useState<string>("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <label htmlFor="name" className="mb-2 text-lg font-semibold">
        Name:
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={handleChange}
        placeholder="Please type here"
        className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {name && <p className="mt-2 text-blue-500">Hello, {name}!</p>}
    </div>
  );
};

export default EditableName;
