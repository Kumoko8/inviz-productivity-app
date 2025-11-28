import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "../src/pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const MAINTENANCE = true; // ← flip to false when fixed

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
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}


//export default App;
