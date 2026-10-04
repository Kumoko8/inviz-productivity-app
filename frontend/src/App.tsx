import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "../src/pages/Home";

const About = lazy(() => import("./pages/About"));
const Services = lazy(() => import("./pages/Services"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

export default function App() {
  const MAINTENANCE = false; // ← flip to false when fixed

  if (MAINTENANCE) {
    return (
      <div style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        textAlign: "center",
        background: "#f4f4f4",
        fontFamily: "sans-serif"
      }}>
        <div>
          <h1>🚧 Site Under Maintenance</h1>
          <p>Sorry for the inconvenience! Your data exists but is not showing up for some reason! We will be back online soon when I fix it. Thank you for your patience!</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Header />
      <Suspense fallback={<div role="status" className="p-4 text-center">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </Router> 
  );
}


//rotated API Key 12-1
//next figure out Google Auth settings
//Google Auth complete
//firestore rules updated to require auth
//some kind of authentication error remains(done)
//fixed firestore rules(done)
//edit Character data
//edit Firebase storage
//edit dashboard to load from firestore
//set Amy animation and other changed backgrounds
//test and match firestore documents

