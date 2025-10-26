// src/pages/DashboardPage.tsx
import React from "react";
import Dashboard from "../components/Dashboard"; // adjust the path if needed

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <Dashboard />
    </div>
  );
};

export default DashboardPage;

