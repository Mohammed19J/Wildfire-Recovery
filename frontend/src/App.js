import React from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Statistics from "./pages/Statistics";
import Simulation from "./pages/Simulation";
import Calculations from "./pages/Calculations";
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/simulation" element={<Simulation />} />
      <Route path="/Calculations" element={<Calculations />} />
    </Routes>
  );
}

export default App;
