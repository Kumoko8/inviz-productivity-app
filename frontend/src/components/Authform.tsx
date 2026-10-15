// src/components/AuthForm.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

interface AuthFormProps {
  isSignup: boolean;
}

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
  { label: "A special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const AuthForm: React.FC<AuthFormProps> = ({ isSignup }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();
  const auth = getAuth();

  const handleForgotPassword = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("If an account exists for that email, a reset link has been sent. Check your spam folder too.");
    } catch (err: any) {
      console.error("Password reset error:", err);
      if (err?.code === "auth/invalid-email") setError("Please enter a valid email address.");
      else if (err?.code === "auth/too-many-requests") setError("Too many attempts. Please try again later.");
      else setInfo("If an account exists for that email, a reset link has been sent. Check your spam folder too.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (isSignup && !PASSWORD_RULES.every((r) => r.test(password))) {
      setError("Password does not meet the requirements below.");
      return;
    }

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard"); // ✅ Redirect after login/signup
    } catch (err: any) {
      // Log full error for debugging and show a clearer message in the UI
      console.error("Auth error:", err);
      const code = err?.code || "unknown";
      const message = err?.message || "Authentication failed";
      setError(`${code}: ${message}`);
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
          className={`w-full p-2 ${isSignup ? "mb-2" : "mb-4"} border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-400`}
          required
        />

        {isSignup && (
          <ul className="text-xs mb-4 space-y-0.5">
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.label} className={ok ? "text-green-600" : "text-gray-500"}>
                  {ok ? "✓" : "○"} {r.label}
                </li>
              );
            })}
          </ul>
        )}

        {!isSignup && (
          <div className="text-right -mt-2 mb-3">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-cyan-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        {info && <p className="text-green-600 text-sm mb-3">{info}</p>}

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
