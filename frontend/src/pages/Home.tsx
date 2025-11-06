import React from "react";
import { Link } from "react-router-dom";

const Home: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      {/* Hero Section */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl md:text-6xl font-extrabold text-cyan-400">
          Welcome to INVIZ Productivity
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Transforming "must do" into "want to"
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-10 flex space-x-6">
        <Link
          to="/login"
          className="px-6 py-3 rounded-lg font-semibold text-black bg-cyan-400 hover:bg-cyan-300 transition-colors duration-300 shadow-md"
        >
          Login
        </Link>
        <Link
          to="/signup"
          className="px-6 py-3 rounded-lg font-semibold text-white bg-yellow-500 hover:bg-magenta-400 transition-colors duration-300 shadow-md"
        >
          Sign Up
        </Link>
      </div>

      {/* Accent Line */}
      <div className="mt-16 w-64 h-1 bg-gradient-to-r from-cyan-400 via-yellow-400 to-magenta-500 rounded-full"></div>

      {/* Footer Note */}
      <p className="mt-6 text-gray-500 text-sm">
        Designed to help you create, track, and succeed.
      </p>
    </div>
  );
};

export default Home;
