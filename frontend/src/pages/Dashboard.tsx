// src/pages/DashboardPage.tsx
import React from "react";
import Dashboard from "../components/Dashboard";
import Name from "../components/EditableName"; // adjust the path if needed
import EditableName from "../components/EditableName";

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Dashboard />
    </div>
  );
};

export default DashboardPage;

