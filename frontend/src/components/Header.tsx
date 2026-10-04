import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

const Header: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useUser();

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <div className="text-lg font-bold">NVZ Productivity</div>

      <nav
        className={`${menuOpen ? "block" : "hidden"
          } absolute top-16 right-4 bg-gray-800 w-48 p-4 rounded-lg shadow-lg md:static md:w-auto md:p-0 md:shadow-none md:flex`}
      >
        <ul className="space-y-4 md:space-y-0 md:flex md:space-x-6">
          <li>
            <Link to="/" className="hover:underline" onClick={() => setMenuOpen(false)}>
              Home
            </Link>
          </li>
          {!loading && user ? (
            <li>
              <button
                onClick={async () => {
                  try {
                    const [{ signOut }, { auth }] = await Promise.all([
                      import("firebase/auth"),
                      import("../firebase"),
                    ]);
                    await signOut(auth);
                    setMenuOpen(false);
                    setShowToast(true);
                    navigate('/');
                    window.setTimeout(() => setShowToast(false), 3000);
                  } catch (e) { console.error('Sign out error', e); }
                }}
                className="hover:underline"
              >
                Logout
              </button>
            </li>
          ) : (
            <li>
              <Link to="/login" className="hover:underline" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
            </li>
          )}
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

      {/* Toast */}
      {showToast && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black text-white px-6 py-3 rounded shadow-md pointer-events-auto">
            Successfully logged out!
          </div>
        </div>
      )}

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
