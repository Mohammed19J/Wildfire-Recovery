import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, LayersControl } from "react-leaflet";
import FloatingLeaves from "../components/FloatingLeaves";
import { Button, Tooltip, FormControl, Select, MenuItem, InputLabel } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import LandscapeIcon from "@mui/icons-material/Landscape";
import GrainIcon from "@mui/icons-material/Grain";
import CloudIcon from "@mui/icons-material/Cloud";
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat";
import PublicIcon from "@mui/icons-material/Public";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

// Legend definitions:
// — Fire, AOD, LST as before
// — Precipitation palette per GEE (min:1, max:17 mm/day): 
//   palette: ['001137','0aab1e','e7eb05','ff4a2d','e90000'] :contentReference[oaicite:1]{index=1}
// — Climate palette from your Python visualize: ['white','green','blue']
const legends = {
  fire: [
    { color: "#FF0000", label: "Fire damage" },
  ],
  landCover: [
    { color: "#006400", label: "Tree cover" },
    { color: "#ffbb22", label: "Shrubland" },
    { color: "#ffff4c", label: "Grassland" },
    { color: "#f096ff", label: "Cropland" },
    { color: "#fa0000", label: "Built-up" },
    { color: "#b4b4b4", label: "Bare/sparse veg." },
    { color: "#f0f0f0", label: "Snow & ice" },
    { color: "#0064c8", label: "Water" },
    { color: "#0096a0", label: "Herb. wetland" },
    { color: "#00cf75", label: "Mangroves" },
    { color: "#fae6a0", label: "Moss & lichen" },
  ],
  precip: [
    { color: "#001137", label: "< 5 mm/day" },
    { color: "#0aab1e", label: "5–8 mm/day" },
    { color: "#e7eb05", label: "8–12 mm/day" },
    { color: "#ff4a2d", label: "12–16 mm/day" },
    { color: "#e90000", label: "> 16 mm/day" },
  ],
  aod: [
    { color: "#000000", label: "< 0.1" },
    { color: "#0000FF", label: "0.1–0.3" },
    { color: "#800080", label: "0.3–0.5" },
    { color: "#00FFFF", label: "0.5–0.7" },
    { color: "#00FF00", label: "0.7–0.9" },
    { color: "#FFFF00", label: "0.9–1.1" },
    { color: "#FF0000", label: "> 1.1" },
  ],
  lst: [
    { color: "#040274", label: "< 280 K" },
    { color: "#235cb1", label: "280–300 K" },
    { color: "#86e26f", label: "300–310 K" },
    { color: "#ff8b13", label: "310–320 K" },
    { color: "#911003", label: "> 320 K" },
  ],
  climate: [
    { color: "#ffffff", label: "< 100 mm" },
    { color: "#008000", label: "100–200 mm" },
    { color: "#0000ff", label: "> 200 mm" },
  ],
};

function LegendRow({ data }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 8,
    }}>
      {data.map(({ color, label }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 20,
            height: 20,
            backgroundColor: color,
            border: "1px solid #999",
          }}/>
          <span style={{ fontSize: "0.9rem" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Simulation() {
  const [tiles, setTiles] = useState([]);
  const [tileSet, setTileSet] = useState('monthly');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const [selectedOverlays, setSelectedOverlays] = useState({
    fire: true,
    landCover: false,
    precip: false,
    aod: false,
    lst: false,
    climate: false,
  });

  const navigate = useNavigate();
  const currentTile = tiles[currentIndex] || {};

  useEffect(() => {
    const endpoint = tileSet === 'monthly' ? 'monthly-tiles' : 'eaton-fire-tiles';
    const apiBase = process.env.NODE_ENV === "production" ? "/api" : "http://localhost:5000/api";
    fetch(`${apiBase}/${endpoint}`)
      .then((res) => res.json())
      .then(setTiles)
      .catch(console.error);
  }, [tileSet]);

  useEffect(() => {
    if (isPlaying && tiles.length) {
      const id = setInterval(() => {
        setCurrentIndex((i) => (i + 1) % tiles.length);
      }, 2500);
      setIntervalId(id);
      return () => clearInterval(id);
    }
  }, [isPlaying, tiles]);

  const togglePlay = () => {
    if (isPlaying) clearInterval(intervalId);
    setIsPlaying((p) => !p);
  };

  const handleOverlayChange = (key) =>
    setSelectedOverlays((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleTileSetChange = (event) => {
    setTileSet(event.target.value);
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  return (
    <div
      className="page"
      style={{
        fontFamily: "'Quicksand', sans-serif",
        textAlign: "center",
        padding: 20,
        background: "#eafce9",
      }}
    >
      {/* Back to home */}
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
      >
        Back to Home
      </Button>

      <FloatingLeaves />

      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold" }}>🌍 Simulation</h1>

      <FormControl 
        sx={{ 
          m: 1, 
          minWidth: 200, 
          marginBottom: 3,
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: '#2e7d32',
            },
            '&:hover fieldset': {
              borderColor: '#388e3c',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2e7d32',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#2e7d32',
            '&.Mui-focused': {
              color: '#2e7d32',
            },
          },
          '& .MuiSelect-icon': {
            color: '#2e7d32',
          },
        }}
      >
        <InputLabel id="tile-set-label">Tile Set</InputLabel>
        <Select
          labelId="tile-set-label"
          value={tileSet}
          label="Tile Set"
          onChange={handleTileSetChange}
        >
          <MenuItem value="monthly">The Creek Fire</MenuItem>
          <MenuItem value="eaton">Eaton Fire Tiles</MenuItem>
        </Select>
      </FormControl>

      <p style={{ fontSize: "1.2rem", marginBottom: 20 }}>
        {tileSet === 'monthly' 
          ? 'Observe vegetation recovery through Sentinel-2 imagery' 
          : 'View the progression of the Eaton Fire'}
      </p>

      {/* Month slider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 700,
          margin: "0 auto 10px",
        }}
      >
        <strong>Month</strong>
        <input
          type="range"
          min={0}
          max={tiles.length - 1 || 0}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(+e.target.value)}
          disabled={!tiles.length}
          style={{ flexGrow: 1, margin: "0 10px" }}
        />
        <strong>
          {tiles.length
            ? `${currentIndex + 1}/${tiles.length} ${currentTile.date}`
            : "Loading..."}
        </strong>
      </div>

      {/* Filter buttons with tooltips */}
      <div
        style={{
          margin: "18px 0",
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Tooltip title="Highlights fire damage detected by Sentinel-2">
          <Button
            variant={selectedOverlays.fire ? "contained" : "outlined"}
            color="success"
            startIcon={<WhatshotIcon />}
            onClick={() => handleOverlayChange("fire")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            Fire
          </Button>
        </Tooltip>

        <Tooltip title="Display global land cover classification">
          <Button
            variant={selectedOverlays.landCover ? "contained" : "outlined"}
            color="success"
            startIcon={<LandscapeIcon />}
            onClick={() => handleOverlayChange("landCover")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            Land Cover
          </Button>
        </Tooltip>

        <Tooltip title="Daily rainfall from CHIRPS (mm/day)">
          <Button
            variant={selectedOverlays.precip ? "contained" : "outlined"}
            color="success"
            startIcon={<GrainIcon />}
            onClick={() => handleOverlayChange("precip")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            Precip
          </Button>
        </Tooltip>

        <Tooltip title="Aerosol optical depth from MODIS MAIAC">
          <Button
            variant={selectedOverlays.aod ? "contained" : "outlined"}
            color="success"
            startIcon={<CloudIcon />}
            onClick={() => handleOverlayChange("aod")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            AOD
          </Button>
        </Tooltip>

        <Tooltip title="Land surface temperature from MODIS LST (K)">
          <Button
            variant={selectedOverlays.lst ? "contained" : "outlined"}
            color="success"
            startIcon={<DeviceThermostatIcon />}
            onClick={() => handleOverlayChange("lst")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            Surface Temp
          </Button>
        </Tooltip>

        <Tooltip title="Monthly precipitation from TerraClimate (mm)">
          <Button
            variant={selectedOverlays.climate ? "contained" : "outlined"}
            color="success"
            startIcon={<PublicIcon />}
            onClick={() => handleOverlayChange("climate")}
            sx={{ borderRadius: 2, px: 2 }}
          >
            Climate
          </Button>
        </Tooltip>
      </div>

      {/* Dynamic legend */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        {Object.entries(selectedOverlays).map(
          ([key, enabled]) =>
            enabled &&
            legends[key] && <LegendRow key={key} data={legends[key]} />
        )}
      </div>

      {/* Map display */}
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}
      >
        {tiles.length === 0 ? (
          <p>Loading Sentinel-2 monthly imagery…</p>
        ) : (
          <MapContainer
            center={[36.25, -118.9]}
            zoom={9}
            style={{ height: "75vh", width: "100%" }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Sentinel-2">
                <TileLayer
                  url={currentTile.tileUrl}
                  attribution="Sentinel-2 | Earth Engine"
                />
              </LayersControl.BaseLayer>

              {selectedOverlays.fire && currentTile.fireUrl && (
                <LayersControl.Overlay checked name="Fire Damage 🔥">
                  <TileLayer
                    url={currentTile.fireUrl}
                    opacity={0.45}
                    attribution="Fire | Earth Engine"
                  />
                </LayersControl.Overlay>
              )}

              {selectedOverlays.landCover && currentTile.landCoverUrl && (
                <LayersControl.Overlay checked name="Land Cover">
                  <TileLayer
                    url={currentTile.landCoverUrl}
                    opacity={0.5}
                    attribution="ESA WorldCover"
                  />
                </LayersControl.Overlay>
              )}

              {selectedOverlays.precip && currentTile.precipUrl && (
                <LayersControl.Overlay checked name="Precipitation">
                  <TileLayer
                    url={currentTile.precipUrl}
                    opacity={0.5}
                    attribution="CHIRPS"
                  />
                </LayersControl.Overlay>
              )}

              {selectedOverlays.aod && currentTile.aodUrl && (
                <LayersControl.Overlay checked name="Aerosol (AOD)">
                  <TileLayer
                    url={currentTile.aodUrl}
                    opacity={0.5}
                    attribution="MODIS MAIAC AOD"
                  />
                </LayersControl.Overlay>
              )}

              {selectedOverlays.lst && currentTile.lstUrl && (
                <LayersControl.Overlay checked name="Surface Temperature">
                  <TileLayer
                    url={currentTile.lstUrl}
                    opacity={0.5}
                    attribution="MODIS LST"
                  />
                </LayersControl.Overlay>
              )}

              {selectedOverlays.climate && currentTile.climateUrl && (
                <LayersControl.Overlay checked name="Climate (Precip)">
                  <TileLayer
                    url={currentTile.climateUrl}
                    opacity={0.5}
                    attribution="TerraClimate"
                  />
                </LayersControl.Overlay>
              )}
            </LayersControl>
          </MapContainer>
        )}
      </div>

      {/* Play/Pause */}
      <Button
        onClick={togglePlay}
        variant="contained"
        color="success"
        startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        sx={{
          fontSize: "1.2rem",
          padding: "10px 30px",
          borderRadius: 2,
          marginTop: 3,
          boxShadow: "0 6px 12px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
          "&:hover": { transform: "scale(1.05)" },
        }}
      >
        {isPlaying ? "Pause" : "Play"}
      </Button>
    </div>
  );
}
