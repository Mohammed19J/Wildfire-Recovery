import React from "react";
import "./PageStyle.css";
import FloatingLeaves from "../components/FloatingLeaves.jsx";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";

const Statistics = () => {
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

      <h1>📈 Statistics</h1>
      <p>NDVI recovery graph over time:</p>

      {/* Graph */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <img
          src="http://localhost:5000/api/ndvi-graph"
          alt="NDVI Graph"
          style={{
            maxWidth: "95%",
            border: "2px solid #2e8b57",
            borderRadius: "10px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        />
      </div>

      {/* Description */}
      <p style={{ textAlign: "center", marginTop: "20px", maxWidth: "800px", margin: "30px auto", lineHeight: "1.6" }}>
        This graph shows the NDVI recovery over time. The NDVI (Normalized Difference Vegetation Index) is a measure of vegetation health and density.
        A higher NDVI value indicates healthier vegetation. The graph is generated using the NDVI data collected from the satellite images.
      </p>

      {/*Download Button */}
      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <a 
        href="http://localhost:5000/api/ndvi-graph/download"
        download="ndvi_graph.png"
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
            📥 Download NDVI Graph
          </Button>
        </a>
      </div>
    </div>
  );
};

export default Statistics;
