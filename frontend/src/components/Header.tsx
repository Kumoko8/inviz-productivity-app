import React, { useState } from "react";
import { Link } from "react-router-dom";

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <div className="text-lg font-bold">INVIZ Productivity</div>

      <nav
        className={`${
          menuOpen ? "block" : "hidden"
        } absolute top-16 right-4 bg-gray-800 w-48 p-4 rounded-lg shadow-lg md:static md:w-auto md:p-0 md:shadow-none md:flex`}
      >
        <ul className="space-y-4 md:space-y-0 md:flex md:space-x-6">
          <li>
            <Link to="/" className="hover:underline" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/login" className="hover:underline" onClick={() => setMenuOpen(false)}>
              Login
            </Link>
          </li>
          <li>
            <Link to="/about" className="hover:underline" onClick={() => setMenuOpen(false)}>
              About
            </Link>
          </li>
          <li>
            <Link to="/services" className="hover:underline" onClick={() => setMenuOpen(false)}>
              Services
            </Link>
          </li>
          <li>
            <Link to="/contact" className="hover:underline" onClick={() => setMenuOpen(false)}>
              Contact
            </Link>
          </li>
        </ul>
      </nav>

      {/* Mobile menu button */}
      <button
        className="flex flex-col justify-between h-6 w-8 md:hidden text-white"
        onClick={toggleMenu}
      >
        <span className="block h-1 w-full bg-white rounded"></span>
        <span className="block h-1 w-full bg-white rounded"></span>
        <span className="block h-1 w-full bg-white rounded"></span>
      </button>
    </header>
  );
};

export default Header;
