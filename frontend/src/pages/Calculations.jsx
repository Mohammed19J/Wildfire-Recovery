import React from "react";
import "./PageStyle.css";
import FloatingLeaves from "../components/FloatingLeaves.jsx";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";

const Calculation = () => {
  const navigate = useNavigate();

  return (
    <div className="page">
      <FloatingLeaves />

      {/* Back button */}
      <Button
        onClick={() => navigate("/")}
        startIcon={<ArrowBackIcon />}
        variant="contained"
        sx={{
          position: "fixed",
          top: 20,
          left: 20,
          backgroundColor: "#2e7d32",
          "&:hover": { backgroundColor: "#388e3c", transform: "scale(1.05)" },
          transition: "transform .2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        ⬅ Back to Home
      </Button>

      <h1>🧮 Calculation</h1>
      <p>Predicted NDVI growth over time using ecological modeling equations:</p>

      {/* Graph image */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <img
          src="http://localhost:5000/api/prediction/predicted_ndvi.png"
          alt="Predicted NDVI Graph"
          style={{
            maxWidth: "95%",
            border: "2px solid #2e8b57",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        />
      </div>

      {/* Description + Latex Formula */}
      <div style={{ textAlign: "center", margin: "30px auto", maxWidth: "850px" }}>
        <p style={{ fontSize: "1.05rem", lineHeight: "1.6" }}>
          This graph is generated based on a <strong>logistic ecological recovery model</strong> using NDVI data.
          It predicts how vegetation recovers over time after a wildfire.
        </p>

        {/* Formula rendered from Codecogs (high quality image) */}
        <img
          src="https://latex.codecogs.com/png.image?\dpi{150}&space;NDVI(t)=\frac{K}{1+\left(\frac{K-N_0}{N_0}\right)e^{-rt}}"
          alt="NDVI Equation"
          style={{ marginTop: "10px", height: "60px" }}
        />

        <p style={{ fontSize: "1.05rem", marginTop: "20px", lineHeight: "1.6" }}>
          Where: <br />
          <strong>K</strong> = Carrying capacity <br />
          <strong>N₀</strong> = NDVI after the fire <br />
          <strong>r</strong> = Recovery rate <br />
          <strong>t</strong> = Time (months)
        </p>
      </div>

      {/*Download Button */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <a
          href="http://localhost:5000/api/prediction/download"
          style={{ textDecoration: "none" }}
        >
          <Button
            variant="contained"
            color="success"
            startIcon={<DownloadIcon />}
            style={{
              fontSize: "1.1rem",
              padding: "10px 30px",
              borderRadius: "12px",
              fontWeight: "bold",
              backgroundColor: "#2e7d32",
              boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            📥 Download Prediction Graph
          </Button>
        </a>
      </div>
    </div>
  );
};

export default Calculation;
