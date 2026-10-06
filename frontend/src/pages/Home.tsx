import React from "react";
import { Link } from "react-router-dom";

const Home: React.FC = () => {

  const colors = ['rgb(91, 205, 228)', 'rgb(219, 197, 79)', 'rgb(204, 89, 225)'];
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      {/* Logo */}
      <div className="mb-4">
        <img src="/assets/store/Invizlogo.webp" alt="NVZ Logo" className="h-56 w-auto rounded-lg" />
      </div>

      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 style={{ color: colors[1] }} className="text-4xl md:text-4xl font-extrabold ">
          Productivity
        </h1>
        <p className="text-med md:text-lg text-gray-300 max-w-2xl mx-auto">
          The invisible made visible
        </p>
      </div>

      {/* Buttons */}
      <div className="mt-10 flex space-x-6">
        <Link
          to="/login"
          className="px-6 py-3 rounded-lg font-semibold text-black hover:bg-cyan-300 transition-colors duration-300 shadow-md"
          style={{ backgroundColor: colors[0] }}
        >
          Login
        </Link>
        <Link
          to="/signup"
          className="px-6 py-3 rounded-lg font-semibold text-white hover:bg-magenta-400 transition-colors duration-300 shadow-md"
          style={{ backgroundColor: colors[3] }}
        >
          Sign Up
        </Link>
      </div>
      <Link
          to="/services"
          className="px-6 py-2 my-3 rounded-lg font-semibold text-black hover:bg-cyan-300 transition-colors duration-300 shadow-md"
          style={{ backgroundColor: colors[1] }}
        >
          Tutoring
        </Link>

      {/* Accent Line */}
      <div className="mt-16 w-64 h-1 bg-gradient-to-r from-cyan-400 via-yellow-400 to-magenta-500 rounded-full"></div>

      {/* Footer Note */}

    </div>
  );
};

export default Home;
