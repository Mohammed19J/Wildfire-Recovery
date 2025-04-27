import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import FloatingLeaves from "../components/FloatingLeaves";
import { Button } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
// Import custom CSS for the map
export default function Simulation() {
  const [tiles, setTiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
// Fetch the tile data from the server
  useEffect(() => {
    fetch("http://localhost:5000/api/monthly-tiles")
      .then((res) => res.json())
      .then((data) => {
        console.log("Tiles loaded", data);
        setTiles(data);
      })
      .catch((err) => {
        console.error("Failed to load tile data:", err);
      });
  }, []);
// Set up an interval to change the current index every 2.5 seconds if playing
  useEffect(() => {
    if (isPlaying && tiles.length > 0) {
      const id = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % tiles.length);
      }, 2500);
      setIntervalId(id);
      return () => clearInterval(id);
    }
  }, [isPlaying, tiles]);
// Clear the interval when the component unmounts or when isPlaying changes
  const togglePlay = () => {
    if (isPlaying) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsPlaying((prev) => !prev);
  };

  const currentTile = tiles[currentIndex];
  const navigate = useNavigate();
// Handle the back button click to navigate to the home page
  return (
    <div
      className="page"
      style={{
        fontFamily: "'Quicksand', sans-serif",
        textAlign: "center",
        padding: "20px",
        background: "#eafce9",
      }}
    >
      <Button
        onClick={() => navigate("/")}
        startIcon={<ArrowBackIcon />}
        variant="contained"
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          zIndex: 999,
          fontSize: "1.1rem",
          padding: "10px 22px",
          borderRadius: "12px",
          fontWeight: "bold",
          backgroundColor: "#2e7d32", // dark green
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          transition: "transform 0.2s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = "#388e3c";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = "#2e7d32";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        Back to Home
      </Button>

      <FloatingLeaves />
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>🌍 Simulation</h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "20px" }}>
        Observe vegetation recovery through Sentinel-2 imagery
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 700, margin: "0 auto", marginBottom: "10px" }}>
        <span style={{ fontWeight: "bold" }}>Month</span>
        <input
          type="range"
          min={0}
          max={tiles.length - 1}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
          disabled={!tiles.length}
          style={{ flexGrow: 1, margin: "0 10px" }}
        />
        <span style={{ fontWeight: "bold" }}>
          {currentIndex + 1}/{tiles.length} {tiles[currentIndex]?.date}
        </span>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
        {tiles.length === 0 ? (
          <p>Loading Sentinel-2 monthly imagery...</p>
        ) : currentTile?.tileUrl ? (
          <MapContainer
            center={[36.25, -118.9]}
            zoom={9}
            style={{ height: "75vh", width: "100%" }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Sentinel-2 Imagery">
                <TileLayer
                  url={currentTile.tileUrl}
                  attribution="Sentinel-2 | Earth Engine"
                />
              </LayersControl.BaseLayer>
              {currentTile.fireUrl && (
                <LayersControl.Overlay checked name="Fire Damage Overlay 🔥">
                  <TileLayer
                    url={currentTile.fireUrl}
                    opacity={0.45}
                    attribution="Fire Overlay | Earth Engine"
                  />
                </LayersControl.Overlay>
              )}
            </LayersControl>
          </MapContainer>
        ) : (
          <p>⚠️ Tile URL not available for index {currentIndex}</p>
        )}
      </div>

      <Button
        onClick={togglePlay}
        variant="contained"
        color="success"
        startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        style={{
          fontSize: "1.2rem",
          padding: "10px 30px",
          borderRadius: "12px",
          marginTop: "25px",
          boxShadow: "0 6px 12px rgba(0, 0, 0, 0.2)",
          transition: "transform 0.2s ease",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
      >
        {isPlaying ? "Pause" : "Play"}
      </Button>


    </div>
  );
}
