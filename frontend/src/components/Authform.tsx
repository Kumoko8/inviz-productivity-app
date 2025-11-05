// src/components/AuthForm.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

interface AuthFormProps {
  isSignup: boolean;
}

const AuthForm: React.FC<AuthFormProps> = ({ isSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard"); // ✅ Redirect after login/signup
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-cyan-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-xl shadow-md w-80 border border-gray-200"
      >
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {isSignup ? "Sign Up" : "Login"}
        </h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 mb-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 mb-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400"
          required
        />

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          type="submit"
          className="w-full py-2 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 transition"
        >
          {isSignup ? "Sign Up" : "Login"}
        </button>

        <p className="text-sm text-center mt-4">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <a href="/login" className="text-cyan-600 hover:underline">
                Login
              </a>
            </>
          ) : (
            <>
              Don’t have an account?{" "}
              <a href="/signup" className="text-cyan-600 hover:underline">
                Sign up
              </a>
            </>
          )}
        </p>
      </form>
    </div>
  );
};

export default AuthForm;
