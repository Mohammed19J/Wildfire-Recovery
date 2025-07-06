import React from "react";
import "./PageStyle.css";
import { useNavigate } from "react-router-dom";
import FloatingLeaves from "../components/FloatingLeaves.jsx";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div id="homePage" className="page">
      <FloatingLeaves />
      <h1 className="main-title">🌱 Wildfire Recovery</h1>
      <p className="subtitle">Visualizing the path from destruction to regrowth.</p>
      <div className="button-group">
        <button onClick={() => navigate("/simulation")} className="styled-button">🌍 Simulation</button>
        <button onClick={() => navigate("/calculations")} className="styled-button">🧮 Calculation</button>
      </div>
    </div>
  );
}
