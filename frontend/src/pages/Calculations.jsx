import React, { useState, useEffect, useRef, useCallback } from "react";
import "./PageStyle.css";
import FloatingLeaves from "../components/FloatingLeaves.jsx";
import { useNavigate } from "react-router-dom";
import {
  Button, CircularProgress, Alert, Box, Typography, Paper, Grid, Slider,
  Card, CardContent, Divider, Container, Tooltip as MuiTooltip, Modal, IconButton
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LandscapeIcon from '@mui/icons-material/Landscape';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ForestIcon from '@mui/icons-material/Forest';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import NatureIcon from '@mui/icons-material/Nature';
import TimelineIcon from '@mui/icons-material/Timeline';
import FireExtinguisherIcon from '@mui/icons-material/FireExtinguisher';

// Chart.js imports
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Filler,
  Tooltip as ChartJsTooltip,
  Legend as ChartJsLegend,
} from "chart.js";
Chart.register(LineController, LineElement, PointElement, LinearScale, Title, CategoryScale, Filler, ChartJsTooltip, ChartJsLegend);

const GRID_SIZE = 100;
const API_BASE_URL = process.env.NODE_ENV === "production" ? process.env.REACT_APP_API_URL : "http://localhost:5000";
const FIRE_ANIMATION_SPEED = 120; // ms between fire frames
const RECOVERY_ANIMATION_SPEED = 800; // ms between recovery frames (slower for gradual effect)
const RECOVERY_TOTAL_STEPS = 20; // Total recovery animation steps

// Terrain types and colors
const TERRAIN_TYPES = {
  FOREST: 'forest',
  GRASSLAND: 'grassland',
  SHRUBLAND: 'shrubland',
  BARREN: 'barren',
  WATER: 'water',
};

// NDVI values for terrain types
const TERRAIN_NDVI_VALUES = {
  [TERRAIN_TYPES.FOREST]: { unburned: 0.8, burned: 0.15 },
  [TERRAIN_TYPES.GRASSLAND]: { unburned: 0.6, burned: 0.1 },
  [TERRAIN_TYPES.SHRUBLAND]: { unburned: 0.5, burned: 0.1 },
  [TERRAIN_TYPES.BARREN]: { unburned: 0.2, burned: 0.05 },
  default: { unburned: 0.3, burned: 0.1 }
};
const WATER_NDVI = 0.05;

// Color utility functions
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const interpolateColor = (color1, color2, factor) => {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1;
  
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  return `rgb(${r}, ${g}, ${b})`;
};

const TERRAIN_COLORS = {
  [TERRAIN_TYPES.FOREST]: { 
    unburned: '#228B22',  // Forest Green
    burning: '#FF4500',   // Orange Red
    burned: '#2F1B14'     // Dark Brown
  },
  [TERRAIN_TYPES.GRASSLAND]: { 
    unburned: '#90EE90',  // Light Green
    burning: '#FF6347',   // Tomato
    burned: '#654321'     // Dark Brown
  },
  [TERRAIN_TYPES.SHRUBLAND]: { 
    unburned: '#8FBC8F',  // Dark Sea Green
    burning: '#FF7F50',   // Coral
    burned: '#5D4037'     // Brown
  },
  [TERRAIN_TYPES.BARREN]: { 
    unburned: '#D2B48C',  // Tan
    burning: '#FFA07A',   // Light Salmon
    burned: '#8D6E63'     // Medium Brown
  },
  [TERRAIN_TYPES.WATER]: { 
    unburned: '#4682B4',  // Steel Blue
    burning: '#4682B4',   // Water doesn't burn
    burned: '#4682B4'     // Water doesn't burn
  },
  default: { 
    unburned: '#F0F0F0',  // Light Gray
    burning: '#FF0000',   // Red
    burned: '#505050'     // Dark Gray
  }
};

// Simulation states
const SIMULATION_STATES = {
  IDLE: 'idle',
  FIRE_SPREADING: 'fire_spreading', 
  FIRE_COMPLETE: 'fire_complete',
  RECOVERING: 'recovering',
  RECOVERY_COMPLETE: 'recovery_complete'
};

const STATUS_PHASES = [
  { key: SIMULATION_STATES.IDLE, label: 'Ready', color: '#90caf9', icon: <TimelineIcon sx={{mr:0.5}}/> },
  { key: SIMULATION_STATES.FIRE_SPREADING, label: 'Fire Spreading', color: '#ff5722', icon: <LocalFireDepartmentIcon sx={{mr:0.5}}/> },
  { key: SIMULATION_STATES.RECOVERING, label: 'Recovering', color: '#4caf50', icon: <ForestIcon sx={{mr:0.5}}/> },
  { key: SIMULATION_STATES.RECOVERY_COMPLETE, label: 'Complete', color: '#9e9e9e', icon: <FireExtinguisherIcon sx={{mr:0.5}}/> },
];

const Calculation = () => {
  const navigate = useNavigate();
  
  // Refs
  const ndviChartRef = useRef(null);
  const simulationCanvasRef = useRef(null);
  const animationIntervalRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const startRecoveryRef = useRef(null); // Ref for startRecovery
  const simCompChartRef = useRef(null);
  const simCompChartInstance = useRef(null); // Ref for comparison chart instance
  const realNdviChartRef = useRef(null); // Ref for real NDVI chart
  const realNdviChartInstance = useRef(null); // Ref for real NDVI chart instance

  // Basic state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
    // Data state
  const [availableFires, setAvailableFires] = useState([]);
  const [aggregatedNdvi, setAggregatedNdvi] = useState({ labels: [], values: [] });
  const [realFireNdvi, setRealFireNdvi] = useState({ labels: [], values: [] });
    // Simulation state
  const [simState, setSimState] = useState(SIMULATION_STATES.IDLE);
  const [simParams, setSimParams] = useState({ elevation: 1000, slope: 10, temperature: 25, humidity: 40 });
  const [fuelGrid, setFuelGrid] = useState([]);  const [burnedCells, setBurnedCells] = useState(new Set());
  const [activeFire, setActiveFire] = useState(new Set()); // Currently burning cells
  const [fireTimeline, setFireTimeline] = useState([]);
  const [simResults, setSimResults] = useState(null);
  const [simulationNdviData, setSimulationNdviData] = useState({ labels: [], values: [] });
  
  // Recovery state
  const [recoveryProgress, setRecoveryProgress] = useState(0); // 0 to 1
  const [cellRecoveryData, setCellRecoveryData] = useState(new Map()); // Cell-specific recovery info
  const [recoveryNdviData, setRecoveryNdviData] = useState({ labels: [], values: [] });

  // UI state
  const [showLegend, setShowLegend] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState('baseline');
  // Utility function for API calls
  const fetchJson = useCallback(async (url, errorContext = '') => {
    try {
      console.log(`[fetchJson] Attempting to fetch: ${url}`);
      const response = await fetch(url);
      console.log(`[fetchJson] Response status for ${errorContext}: ${response.status}`);
      
      if (!response.ok) {
        console.warn(`Failed to fetch ${errorContext}: ${response.status} ${response.statusText}`);
        return null;
      }
      
      const text = await response.text();
      console.log(`[fetchJson] Response text preview for ${errorContext}:`, text.substring(0, 200));
      
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.error(`Invalid JSON response for ${errorContext}:`, text.substring(0, 200));
        console.error(`Parse error:`, parseErr);
        return null;
      }
    } catch (err) {
      console.error(`Error fetching ${errorContext}:`, err);
      return null;
    }
  }, []);

  // Generate mock fuel grid
  const generateFuelGrid = useCallback(() => {
    const grid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => {
        const rand = Math.random();
        if (rand < 0.05) return TERRAIN_TYPES.WATER;
        if (rand < 0.45) return TERRAIN_TYPES.FOREST;
        if (rand < 0.75) return TERRAIN_TYPES.GRASSLAND;
        if (rand < 0.90) return TERRAIN_TYPES.SHRUBLAND;
        return TERRAIN_TYPES.BARREN;
      })
    );
    setFuelGrid(grid);
  }, []);

  // Generate recovery NDVI trajectory
  const generateRecoveryTrajectory = useCallback(() => {
    const steps = RECOVERY_TOTAL_STEPS;
    const labels = Array.from({ length: steps }, (_, i) => `Month ${i + 1}`);
    const values = Array.from({ length: steps }, (_, i) => {
      // Exponential recovery curve from 0.2 to 0.8
      const progress = i / (steps - 1);
      return 0.2 + 0.6 * (1 - Math.exp(-2.5 * progress));
    });
    
    setRecoveryNdviData({ labels, values });
    return { labels, values };
  }, []);

  // Initialize data on component mount
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      try {
        // Try to fetch real wildfire data
        const fires = await fetchJson(`${API_BASE_URL}/api/wildfire/fires`, 'available fires');
        if (fires && fires.length > 0) {
          setAvailableFires(fires);

          // Try to get aggregated NDVI data
          const enhancedNdvi = await fetchJson(`${API_BASE_URL}/api/prediction/ndvi`, 'enhanced NDVI data');
          if (enhancedNdvi && enhancedNdvi.values) {
            setAggregatedNdvi({
              labels: enhancedNdvi.dates || enhancedNdvi.labels || [],
              values: enhancedNdvi.values
            });
          } else {
            // Fallback NDVI data
            const fallbackNdvi = Array.from({ length: 24 }, (_, i) => 0.3 + 0.5 * (1 - Math.exp(-0.1 * i)));
            setAggregatedNdvi({
              labels: Array.from({ length: 24 }, (_, i) => `Month ${i + 1}`),
              values: fallbackNdvi
            });
          }
        } else {
          setError("No wildfire data available. Using mock data.");
          // Generate fallback data
          const fallbackNdvi = Array.from({ length: 24 }, (_, i) => 0.3 + 0.5 * (1 - Math.exp(-0.1 * i)));
          setAggregatedNdvi({
            labels: Array.from({ length: 24 }, (_, i) => `Month ${i + 1}`),
            values: fallbackNdvi
          });
        }
        
        // Generate fuel grid and recovery trajectory
        generateFuelGrid();
        generateRecoveryTrajectory();
        
      } catch (err) {
        console.error("Initialization error:", err);
        setError("Failed to load data. Using defaults.");
        
        // Generate all fallback data
        generateFuelGrid();
        generateRecoveryTrajectory();
        const fallbackNdvi = Array.from({ length: 24 }, (_, i) => 0.3 + 0.5 * (1 - Math.exp(-0.1 * i)));
        setAggregatedNdvi({
          labels: Array.from({ length: 24 }, (_, i) => `Month ${i + 1}`),
          values: fallbackNdvi
        });
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [fetchJson, generateFuelGrid, generateRecoveryTrajectory]);

  // Calculate current grid NDVI with optional override parameters
  const calculateCurrentGridNdvi = useCallback((overrideActiveFire = null, overrideBurnedCells = null, overrideRecoveryProgress = null, overrideSimState = null, overrideCellRecoveryData = null) => {
    if (fuelGrid.length === 0) return 0;

    // Use override parameters if provided, otherwise fall back to state
    const currentActiveFire = overrideActiveFire !== null ? overrideActiveFire : activeFire;
    const currentBurnedCells = overrideBurnedCells !== null ? overrideBurnedCells : burnedCells;
    const currentRecoveryProgress = overrideRecoveryProgress !== null ? overrideRecoveryProgress : recoveryProgress;
    const currentSimState = overrideSimState !== null ? overrideSimState : simState;
    const currentCellRecoveryData = overrideCellRecoveryData !== null ? overrideCellRecoveryData : cellRecoveryData;

    let totalNdvi = 0;
    let landCellCount = 0;

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cellKey = `${col},${row}`;
        const terrainType = fuelGrid[row]?.[col];

        if (!terrainType) continue;

        if (terrainType === TERRAIN_TYPES.WATER) {
          totalNdvi += WATER_NDVI;
        } else {
          const ndviBases = TERRAIN_NDVI_VALUES[terrainType] || TERRAIN_NDVI_VALUES.default;
          let currentCellNdvi;

          if (currentActiveFire.has(cellKey)) {
            currentCellNdvi = 0.05; // Very low NDVI for actively burning cells
          } else if ((currentSimState === SIMULATION_STATES.RECOVERING || currentSimState === SIMULATION_STATES.RECOVERY_COMPLETE) && currentBurnedCells.has(cellKey)) {
            const cellRecovery = currentCellRecoveryData.get(cellKey);
            if (cellRecovery) {
              const cellProgress = Math.min(1, Math.max(0, (currentRecoveryProgress - cellRecovery.startProgress) / cellRecovery.duration));
              currentCellNdvi = ndviBases.burned + (ndviBases.unburned - ndviBases.burned) * cellProgress;
            } else {
              currentCellNdvi = ndviBases.burned;
            }
          } else if (currentBurnedCells.has(cellKey)) {
            currentCellNdvi = ndviBases.burned;
          } else {
            currentCellNdvi = ndviBases.unburned;
          }
          totalNdvi += currentCellNdvi;
        }
        landCellCount++;
      }
    }
    return landCellCount > 0 ? totalNdvi / landCellCount : 0;
  }, [fuelGrid, activeFire, burnedCells, simState, recoveryProgress, cellRecoveryData]);

  // Draw the simulation grid
  const drawGrid = useCallback(() => {
    const canvas = simulationCanvasRef.current;
    if (!canvas || fuelGrid.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const cellSize = canvas.width / GRID_SIZE;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cellKey = `${col},${row}`;
        const terrainType = fuelGrid[row][col];
        const colors = TERRAIN_COLORS[terrainType] || TERRAIN_COLORS.default;
        
        let cellColor;
        if (activeFire.has(cellKey)) {
          // Cell is actively burning - show fire colors
          cellColor = colors.burning;
        } else if ((simState === SIMULATION_STATES.RECOVERING || simState === SIMULATION_STATES.RECOVERY_COMPLETE) && burnedCells.has(cellKey)) {
          // During recovery or when recovery is complete, use individual cell recovery progress
          const cellRecovery = cellRecoveryData.get(cellKey);
          if (cellRecovery) {
            const cellProgress = Math.min(1, Math.max(0, (recoveryProgress - cellRecovery.startProgress) / cellRecovery.duration));
            if (cellProgress > 0) {
              cellColor = interpolateColor(colors.burned, colors.unburned, cellProgress);
            } else {
              cellColor = colors.burned;
            }
          } else {
            // Cell was burned but has no specific recovery data (e.g., permanently damaged)
            cellColor = colors.burned;
          }
        } else if (burnedCells.has(cellKey)) {
          // Cell is burned but not in recovery phase yet (e.g. fire_complete state before recovery starts)
          cellColor = colors.burned;
        } else {
          // Cell is unburned
          cellColor = colors.unburned;
        }
        
        ctx.fillStyle = cellColor;
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }
  }, [fuelGrid, burnedCells, activeFire, simState, recoveryProgress, cellRecoveryData]);

  // Update NDVI chart
  const updateChart = useCallback(() => {
    const canvas = ndviChartRef.current;
    if (!canvas) return;
    
    // Destroy existing chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(46,125,50,0.3)');
    gradient.addColorStop(1, 'rgba(46,125,50,0)');
    
    let chartData;
    let chartTitle;
    
    if (simulationNdviData.values.length > 0) {
      chartData = simulationNdviData;
      chartTitle = "Live Simulation NDVI";
    } else if (aggregatedNdvi.values.length > 0) {
      chartData = aggregatedNdvi;
      chartTitle = "NDVI Recovery Trajectory (Historical/Aggregated)";
    } else {
      // Fallback: show the generated recovery trajectory as a preview if no other data
      chartData = recoveryNdviData; 
      chartTitle = "Recovery Potential Preview";
      if (recoveryNdviData.labels.length === 0) { // If even that is empty
        chartData = { labels: ["No Data"], values: [0] };
        chartTitle = "NDVI Data Unavailable";
      }
    }
    
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'NDVI',
          data: chartData.values,
          borderColor: '#2e7d32',
          backgroundColor: gradient,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#2e7d32',
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: (simState === SIMULATION_STATES.FIRE_SPREADING || simState === SIMULATION_STATES.RECOVERING) ? 0 : 500
        },
        plugins: {
          legend: { display: true, position: 'top' },
          title: { display: true, text: chartTitle }
        },
        scales: {
          x: { 
            title: { display: true, text: "Time" },
            grid: { color: 'rgba(0,0,0,0.1)' }
          },
          y: { 
            title: { display: true, text: "NDVI" },
            min: 0,
            max: 1,
            grid: { color: 'rgba(0,0,0,0.1)' }
          }
        }      }
    });
  }, [simState, recoveryNdviData, aggregatedNdvi, simulationNdviData]);

  // Effects for drawing and updating
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  useEffect(() => {
    updateChart();  }, [updateChart]);

  // Load and normalize Creek Fire NDVI for comparison (from CSV only)
  useEffect(() => {
    console.log('Loading Creek Fire NDVI data...');
    fetch('/wildfire_data/Creek_Fire_2020/satellite/creek_fire_ndvi.csv')
      .then(r => {
        console.log('CSV fetch response status:', r.status);
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${r.statusText}`);
        }
        return r.text();
      })
      .then(csv => {
        console.log('CSV loaded, length:', csv.length);
        const lines = csv.trim().split('\n');
        console.log('CSV lines count:', lines.length);
        const records = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          const date = parts[0];
          const ndvi = parseFloat(parts[1]);
          if (!isNaN(ndvi) && date) records.push({ date, ndvi });
        }
        console.log('Parsed records count:', records.length);
        console.log('First few records:', records.slice(0, 3));
        setRealFireNdvi({ labels: records.map(r => r.date), values: records.map(r => r.ndvi) });
      })
      .catch((error) => {
        console.error('Failed to load Creek Fire NDVI data:', error);
        setRealFireNdvi({ labels: [], values: [] });
      });
  }, []);

  // Align and plot both NDVI series on the same chart
  useEffect(() => {
    if (!showComparison) return;
    console.log('Creating comparison charts, showComparison:', showComparison);
    console.log('Real fire NDVI data:', realFireNdvi);
    console.log('Simulation NDVI data:', simulationNdviData);
    
    // Simulated NDVI chart (left)
    setTimeout(() => {
      console.log('Creating simulated NDVI chart...');
      if (simCompChartInstance.current) simCompChartInstance.current.destroy();
      if (!simCompChartRef.current) {
        console.log('simCompChartRef.current is null');
        return;
      }
      const simVals = simulationNdviData.values;
      const simLabels = simulationNdviData.labels;
      if (simVals.length === 0) {
        console.log('No simulation values to plot');
        return;
      }
      console.log('Creating simulated chart with', simVals.length, 'data points');
      const simCtx = simCompChartRef.current.getContext('2d');
      simCompChartInstance.current = new Chart(simCtx, {
        type: 'line',
        data: {
          labels: simLabels,
          datasets: [
            {
              label: 'Simulation NDVI',
              data: simVals,
              borderColor: '#2e7d32',
              backgroundColor: 'rgba(46,125,50,0.1)',
              tension: 0.3,
              fill: true,
              pointRadius: 3,
            }
          ]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 1, title: { display: true, text: 'NDVI' } },
            x: { title: { display: true, text: 'Time' } }
          },
          plugins: {
            legend: { display: false },
            title: { display: false }
          }
        }
      });
    }, 100);
    
    // Real NDVI chart (right)
    setTimeout(() => {
      console.log('Creating real NDVI chart...');
      if (!realNdviChartRef.current) {
        console.log('realNdviChartRef.current is null');
        return;
      }
      if (realNdviChartInstance.current) realNdviChartInstance.current.destroy();
      const realCtx = realNdviChartRef.current.getContext('2d');
      if (!realFireNdvi.values.length) {
        console.log('No real fire values to plot, length:', realFireNdvi.values.length);
        return;
      }
      console.log('Creating real chart with', realFireNdvi.values.length, 'data points');
      realNdviChartInstance.current = new Chart(realCtx, {
        type: 'line',
        data: {
          labels: realFireNdvi.labels,
          datasets: [
            {
              label: 'Creek Fire NDVI',
              data: realFireNdvi.values,
              borderColor: '#1976d2',
              backgroundColor: 'rgba(25,118,210,0.1)',
              tension: 0.3,
              fill: true,
              pointRadius: 3,
            }
          ]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 1, title: { display: true, text: 'NDVI' } },
            x: { title: { display: true, text: 'Date' } }
          },
          plugins: {
            legend: { display: false },
            title: { display: false }
          }
        }
      });
    }, 200);
    
    return () => {
      if (simCompChartInstance.current) simCompChartInstance.current.destroy();
      if (realNdviChartInstance.current) realNdviChartInstance.current.destroy();
    };
  }, [showComparison, simulationNdviData, realFireNdvi]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearTimeout(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    
    setSimState(SIMULATION_STATES.IDLE);    setBurnedCells(new Set());
    setActiveFire(new Set());
    setCellRecoveryData(new Map());
    setRecoveryProgress(0);
    setFireTimeline([]);
    setSimResults(null);
    setSimulationNdviData({ labels: [], values: [] });
    setShowComparison(false);
  }, []);

  // Start recovery animation
  const startRecovery = useCallback(() => {
    setSimState(SIMULATION_STATES.RECOVERING);
    // recoveryProgress state is set to 0 here, but the local 'progress' variable will drive the animation steps.
    // The first NDVI point uses 0 explicitly.
    
    const initialRecoveryNdvi = calculateCurrentGridNdvi(new Set(), burnedCells, 0, SIMULATION_STATES.RECOVERING, cellRecoveryData);
    setSimulationNdviData(prev => ({
        labels: [...prev.labels, `Rec. Start`],
        values: [...prev.values, initialRecoveryNdvi]
    }));
    
    let currentAnimProgress = 0; // Use a local variable for animation step progress
    const step = 1 / RECOVERY_TOTAL_STEPS;
    
    const animate = () => {
      currentAnimProgress += step;
      
      if (currentAnimProgress >= 1) {
        const finalProgress = 1;
        setRecoveryProgress(finalProgress); // Update state to final progress
        
        const finalRecoveryNdvi = calculateCurrentGridNdvi(new Set(), burnedCells, finalProgress, SIMULATION_STATES.RECOVERY_COMPLETE, cellRecoveryData);
        setSimState(SIMULATION_STATES.RECOVERY_COMPLETE); // Update state before setting final NDVI data

        setSimulationNdviData(prev => ({
            labels: [...prev.labels, `Rec. ${RECOVERY_TOTAL_STEPS}/${RECOVERY_TOTAL_STEPS}`],
            values: [...prev.values, finalRecoveryNdvi]
        }));
        
        setShowComparison(true);
        return;
      }
      
      // Calculate NDVI with current local animation progress
      const currentStepNdvi = calculateCurrentGridNdvi(new Set(), burnedCells, currentAnimProgress, SIMULATION_STATES.RECOVERING, cellRecoveryData);
      setRecoveryProgress(currentAnimProgress); // Update React state for this step
      
      const recoveryStepLabel = `Rec. ${(currentAnimProgress * RECOVERY_TOTAL_STEPS).toFixed(0)}/${RECOVERY_TOTAL_STEPS}`;
      setSimulationNdviData(prev => ({
        labels: [...prev.labels, recoveryStepLabel],
        values: [...prev.values, currentStepNdvi]
      }));

      animationIntervalRef.current = setTimeout(animate, RECOVERY_ANIMATION_SPEED);
    };
    // Set initial recovery progress state before starting animation loop
    setRecoveryProgress(0); 
    animate();
  }, [calculateCurrentGridNdvi, burnedCells, cellRecoveryData]);

  // Update the ref whenever startRecovery is re-memoized
  useEffect(() => {
    startRecoveryRef.current = startRecovery;
  }, [startRecovery]);

  // Animate fire spread
  const animateFireSpread = useCallback((timeline) => {
    let frameIndex = 0;
    const allBurnedAccumulator = new Set(); // Use a local accumulator for allBurned
    
    const animate = () => {
      if (frameIndex >= timeline.length) {
        setActiveFire(new Set()); 
        const finalBurnedCellsSet = new Set(allBurnedAccumulator);
        setBurnedCells(finalBurnedCellsSet);
        setSimState(SIMULATION_STATES.FIRE_COMPLETE);
        
        const recoveryMap = new Map();
        finalBurnedCellsSet.forEach(cellKey => {
          const [col, row] = cellKey.split(',').map(Number);
          const terrainType = fuelGrid[row] && fuelGrid[row][col] ? fuelGrid[row][col] : TERRAIN_TYPES.GRASSLAND;
          
          let baseRecoveryDuration, baseStartDelay;
          switch (terrainType) {
            case TERRAIN_TYPES.FOREST:
              baseRecoveryDuration = 0.6; 
              baseStartDelay = 0.2; 
              break;
            case TERRAIN_TYPES.GRASSLAND:
              baseRecoveryDuration = 0.3; 
              baseStartDelay = 0.05;
              break;
            case TERRAIN_TYPES.SHRUBLAND:
              baseRecoveryDuration = 0.4;
              baseStartDelay = 0.1;
              break;
            case TERRAIN_TYPES.BARREN:
              baseRecoveryDuration = 0.8; 
              baseStartDelay = 0.4;
              break;
            default:
              baseRecoveryDuration = 0.5;
              baseStartDelay = 0.15;
          }
          
          const randomFactor = 0.5 + Math.random(); 
          const startProgress = baseStartDelay + (Math.random() - 0.5) * 0.2; 
          const duration = Math.max(0.1, baseRecoveryDuration * randomFactor);
          
          const permanentDamageChance = terrainType === TERRAIN_TYPES.BARREN ? 0.3 : 
                                       terrainType === TERRAIN_TYPES.FOREST ? 0.15 : 0.05;
          
          if (Math.random() > permanentDamageChance) {
            recoveryMap.set(cellKey, {
              startProgress: Math.max(0, Math.min(0.8, startProgress)),
              duration: Math.min(0.9, duration)
            });
          }
        });
        
        setCellRecoveryData(recoveryMap);
        // Call the latest startRecovery via ref
        setTimeout(() => {
            if (startRecoveryRef.current) {
                startRecoveryRef.current();
            }
        }, 1000);
        return;
      }
      
      const currentlyBurning = new Set();
      if (timeline[frameIndex]) {
        timeline[frameIndex].forEach(cell => {
          const cellKey = Array.isArray(cell) ? `${cell[0]},${cell[1]}` : cell;
          currentlyBurning.add(cellKey);
          allBurnedAccumulator.add(cellKey); // Add to local accumulator
        });      }      
      // Pass 0 for recoveryProgress during fire spreading (explicit value, not state)
      const currentNdvi = calculateCurrentGridNdvi(currentlyBurning, new Set(allBurnedAccumulator), 0, SIMULATION_STATES.FIRE_SPREADING, null);
      
      setActiveFire(currentlyBurning);
      setBurnedCells(new Set(allBurnedAccumulator)); // Update state with accumulated burned cells
      
      setSimulationNdviData(prev => ({
        labels: [...prev.labels, `Fire ${frameIndex + 1}`],
        values: [...prev.values, currentNdvi]
      }));

      frameIndex++;
      animationIntervalRef.current = setTimeout(animate, FIRE_ANIMATION_SPEED);
    };
    
    animate();
  }, [fuelGrid, calculateCurrentGridNdvi]); // Remove recoveryProgress from dependencies

  // Fire simulation
  const runFireSimulation = useCallback(async () => {
    try {
      setSimState(SIMULATION_STATES.FIRE_SPREADING);
      setBurnedCells(new Set());
      setActiveFire(new Set());
      setCellRecoveryData(new Map());
      setRecoveryProgress(0); // Ensure recoveryProgress is reset
      setSimResults(null);
      
      const initialNdvi = calculateCurrentGridNdvi(null, new Set(), 0, SIMULATION_STATES.IDLE, new Map());
      setSimulationNdviData({ labels: ["Start"], values: [initialNdvi] });

      const response = await fetch(`${API_BASE_URL}/api/simulation/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: simParams,
          duration: 60
        })
      });
      
      if (!response.ok) throw new Error('Simulation failed');
      
      const results = await response.json();
      const timeline = results.timeline || [];

      if (timeline.length === 0) {
        setSimState(SIMULATION_STATES.FIRE_COMPLETE);
        setTimeout(() => {
            if (startRecoveryRef.current) {
                startRecoveryRef.current();
            }
        }, 500);
        return;      }
      
      setFireTimeline(timeline);
      setSimResults(results);
      
      // Start fire animation
      animateFireSpread(timeline);
      
    } catch (err) {
      console.error('Fire simulation error:', err);
      setError('Simulation failed: ' + err.message);
      setSimState(SIMULATION_STATES.IDLE);
      setSimulationNdviData({ labels: [], values: [] }); 
    }
  }, [simParams, calculateCurrentGridNdvi, animateFireSpread]);

  // Event handlers
  const handleParamChange = (param, value) => {
    setSimParams(prev => ({ ...prev, [param]: Number(value) }));
  };

  const handleScenarioSelect = (scenario) => {
    setSelectedScenario(scenario);
    if (scenario === 'baseline') {
      setSimParams({ elevation: 1000, slope: 10, temperature: 25, humidity: 40 });
    } else if (scenario === 'high_risk') {
      setSimParams({ elevation: 500, slope: 30, temperature: 35, humidity: 15 });
    }
    resetSimulation();
  };

  const downloadNdviData = () => {
    if (!aggregatedNdvi.labels || aggregatedNdvi.labels.length === 0) {
      alert("No NDVI data available for download.");
      return;
    }
    
    const headers = "Time,NDVI\n";
    const rows = aggregatedNdvi.labels.map((label, i) => 
      `${label},${aggregatedNdvi.values[i]?.toFixed(4) || '0.0000'}`
    ).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ndvi_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get status label for display
  const getStatusLabel = () => {
    switch (simState) {
      case SIMULATION_STATES.FIRE_SPREADING:
        return 'Fire Spreading';
      case SIMULATION_STATES.FIRE_COMPLETE:
        return 'Fire Complete';
      case SIMULATION_STATES.RECOVERING:
        return 'Recovering';
      case SIMULATION_STATES.RECOVERY_COMPLETE:
        return 'Recovery Complete';
      default:
        return 'Ready';
    }
  };

  const isSimulationRunning = () => {
    return simState === SIMULATION_STATES.FIRE_SPREADING || 
           simState === SIMULATION_STATES.RECOVERING;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearTimeout(animationIntervalRef.current);
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      if (simCompChartInstance.current) {
        simCompChartInstance.current.destroy();
      }
      if (realNdviChartInstance.current) {
        realNdviChartInstance.current.destroy();
      }
    };
  }, []);

  // Loading state
  if (loading) {
    return (
      <Box className="page" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <FloatingLeaves />
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading Wildfire Data...</Typography>
      </Box>
    );
  }

  return (
    <div className="page">
      <FloatingLeaves />
      <Button onClick={()=>navigate("/")} startIcon={<ArrowBackIcon/>} variant="contained" sx={{position:"fixed",top:20,left:20,zIndex:1300,backgroundColor:"#2e7d32","&:hover":{backgroundColor:"#388e3c"}}}>Home</Button>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mb: 2, color: "#1b5e20", fontWeight:'bold', textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>Wildfire & Ecosystem Recovery Simulation</Typography>
        {error && <Alert severity="warning" sx={{ mb: 2, boxShadow: 1 }}>{error}</Alert>}
        
        <Grid container spacing={3}>
            <Grid xs={12} md={4}>
                <Card sx={{ mb: 2, height: '100%', boxShadow: 3, borderRadius: 2 }}><CardContent>
                    <Typography variant="h5" gutterBottom sx={{display:'flex',alignItems:'center', color: 'primary.dark', borderBottom: '2px solid #2e7d32', pb: 1}}>
                        <LandscapeIcon sx={{mr:1, color:'primary.main'}}/>Data Summary
                    </Typography>
                    <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1, mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Fires Analyzed:</strong> {availableFires.length}
                        </Typography>
                        {/* Hardcoded fire names as per user request */}
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                Fire Names:
                            </Typography>
                            <Box sx={{ maxHeight: 100, overflowY: 'auto', pl: 1 }}>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.2, mb: 0.25 }}>
                                    • BootLeg Fire
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.2, mb: 0.25 }}>
                                    • Camp Fire
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.2, mb: 0.25 }}>
                                    • Creek Fire
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.2, mb: 0.25 }}>
                                    • Dixie Fire
                                </Typography>
                                <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.2, mb: 0.25 }}>
                                    • Marshall Fire
                                </Typography>                            </Box>
                        </Box>
                        {aggregatedNdvi.values.length > 0 && 
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                <strong>NDVI Data Points:</strong> {aggregatedNdvi.values.length}
                            </Typography>
                        }
                    </Box>
                    <Divider sx={{my:2}}/>
                    <Typography variant="h5" gutterBottom sx={{display:'flex',alignItems:'center', color: 'success.dark'}}>
                        <ForestIcon sx={{mr:1, color:'success.main'}}/>NDVI Recovery
                    </Typography>
                    <Box sx={{height:200, background:"#fdfdfd", borderRadius:2, boxShadow:"inset 0 2px 4px rgba(0,0,0,0.1)", p:2, mb:2}}>
                        {aggregatedNdvi.labels.length>0 ? 
                            <canvas ref={ndviChartRef}/> : 
                            <Typography align="center" sx={{pt:5, color: 'text.secondary'}}>No NDVI data available</Typography>
                        }
                    </Box>
                    <Button 
                        size="small" 
                        variant="outlined" 
                        color="success" 
                        startIcon={<DownloadIcon/>} 
                        onClick={downloadNdviData} 
                        fullWidth
                        sx={{ borderRadius: 2, textTransform: 'none' }}
                    >
                        Download NDVI Data (CSV)
                    </Button>
                </CardContent></Card>
            </Grid>

            <Grid xs={12} md={8}>
                <Card sx={{ mb: 2, height: '100%', boxShadow: 3, borderRadius: 2 }}><CardContent>
                    <Box sx={{display:'flex', justifyContent:'space-between', alignItems:'center', mb:2, borderBottom: '2px solid #2e7d32', pb: 1}}>
                        <Typography variant="h5" sx={{display:'flex',alignItems:'center', color: 'error.dark'}}>
                            <LocalFireDepartmentIcon sx={{mr:1, color:'error.main'}}/>Wildfire Simulation
                        </Typography>
                        <MuiTooltip title="Simulation Status">
                            <Typography variant="overline" sx={{
                                backgroundColor: simState === SIMULATION_STATES.FIRE_SPREADING ? 'orange' : 
                                               simState === SIMULATION_STATES.RECOVERING ? '#4caf50' : 
                                               simState === SIMULATION_STATES.RECOVERY_COMPLETE ? '#9e9e9e' : '#90caf9',
                                px: 2,
                                py: 0.5,
                                borderRadius: 2,
                                color: 'white',
                                fontWeight: 'bold'
                            }}>
                                {getStatusLabel()}
                            </Typography>
                        </MuiTooltip>
                    </Box>
                    
                    <Box sx={{display:'flex', alignItems:'center', gap:2, mb:2}}>
                      <Box sx={{display:'flex', alignItems:'center', gap:0.5}}>
                        {STATUS_PHASES.map((phase, idx) => {
                          const isActive = (simState === phase.key);
                          return (
                            <Box key={phase.key} sx={{display:'flex', alignItems:'center', mr: idx < STATUS_PHASES.length-1 ? 1 : 0}}>
                              <Box sx={{
                                display:'flex', alignItems:'center', px:2, py:1, borderRadius:2, background: phase.color, color: '#fff',
                                fontWeight: isActive ? 'bold' : 'normal',
                                boxShadow: isActive ? 6 : 1,
                                minWidth: 80, justifyContent:'center',
                                border: isActive ? '3px solid #222' : '2px solid transparent',
                                fontSize: isActive ? '1.2rem' : '1rem',
                                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                                transition: 'all 0.2s',
                                zIndex: isActive ? 2 : 1
                              }}>
                                {phase.icon}
                                <span>{phase.label}</span>
                              </Box>
                              {idx < STATUS_PHASES.length-1 && <Typography variant="caption" sx={{mx:0.5, color:'#888'}}>→</Typography>}
                            </Box>
                          );
                        })}
                      </Box>
                      <MuiTooltip title="Simulation phases: Idle (ready) → Burning (fire spread) → Recovery (NDVI-based) → Idle (reset)">
                        <InfoOutlinedIcon color="info" fontSize="small" sx={{ml:1}}/>
                      </MuiTooltip>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid xs={12} sm={6} md={3}>
                            <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                                <Typography variant="body2" gutterBottom><strong>Elevation (m)</strong></Typography>
                                <Slider
                                    value={simParams.elevation}
                                    onChange={(e,v)=>handleParamChange('elevation',v)}
                                    min={0} max={4000} step={50}
                                    disabled={isSimulationRunning()}
                                    sx={{ color: 'primary.main' }}
                                />
                                <Typography variant="caption" color="text.secondary" align="center" display="block">
                                    {simParams.elevation} m
                                </Typography>
                            </Paper>
                        </Grid>

                        <Grid xs={12} sm={6} md={3}>
                            <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                                <Typography variant="body2" gutterBottom><strong>Slope (°)</strong></Typography>
                                <Slider
                                    value={simParams.slope}
                                    onChange={(e,v)=>handleParamChange('slope',v)}
                                    min={0} max={45} step={1}
                                    disabled={isSimulationRunning()}
                                    sx={{ color: 'primary.main' }}
                                />
                                <Typography variant="caption" color="text.secondary" align="center" display="block">
                                    {simParams.slope}°
                                </Typography>
                            </Paper>
                        </Grid>
                        
                        <Grid xs={12} sm={6} md={3}>
                            <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                                <Typography variant="body2" gutterBottom><strong>Temperature (°C)</strong></Typography>
                                <Slider 
                                    value={simParams.temperature} 
                                    onChange={(e,v)=>handleParamChange('temperature',v)} 
                                    min={0} max={50} step={1} 
                                    disabled={isSimulationRunning()}
                                    sx={{ color: 'error.main' }}
                                />
                                <Typography variant="caption" color="text.secondary" align="center" display="block">
                                    {simParams.temperature}°C
                                </Typography>
                            </Paper>
                        </Grid>
                        
                        <Grid xs={12} sm={6} md={3}>
                            <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                                <Typography variant="body2" gutterBottom><strong>Humidity (%)</strong></Typography>
                                <Slider 
                                    value={simParams.humidity} 
                                    onChange={(e,v)=>handleParamChange('humidity',v)} 
                                    min={0} max={100} step={5} 
                                    disabled={isSimulationRunning()}
                                    sx={{ color: 'info.main' }}
                                />
                                <Typography variant="caption" color="text.secondary" align="center" display="block">
                                    {simParams.humidity}%
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    <Box sx={{my:2, display:'flex', flexWrap:'wrap', gap:2, justifyContent:'center' }}>
                      <MuiTooltip title="Baseline: Typical weather and fuel conditions, moderate fire risk. Useful for comparison.">
                        <span>
                          <Button 
                            onClick={()=>handleScenarioSelect('baseline')} 
                            variant="outlined" 
                            size="medium" 
                            startIcon={<NatureIcon/>} 
                            disabled={isSimulationRunning()}
                            sx={{ borderRadius: 2, textTransform: 'none',
                              border: selectedScenario==='baseline' ? '3px solid #388e3c' : undefined,
                              background: selectedScenario==='baseline' ? 'rgba(56,142,60,0.12)' : undefined,
                              fontWeight: selectedScenario==='baseline' ? 'bold' : undefined
                            }}
                          >
                            Baseline Scenario
                          </Button>
                        </span>
                      </MuiTooltip>
                      <MuiTooltip title="High Risk: Hot, dry, steep terrain at low elevation. Demonstrates rapid fire spread and slow recovery.">
                        <span>
                          <Button 
                            onClick={()=>handleScenarioSelect('high_risk')} 
                            variant="outlined" 
                            size="medium" 
                            startIcon={<WhatshotIcon/>} 
                            disabled={isSimulationRunning()}
                            sx={{ borderRadius: 2, textTransform: 'none',
                              color: 'error.main', borderColor: 'error.main',
                              border: selectedScenario==='high_risk' ? '3px solid #d32f2f' : undefined,
                              background: selectedScenario==='high_risk' ? 'rgba(211,47,47,0.12)' : undefined,
                              fontWeight: selectedScenario==='high_risk' ? 'bold' : undefined
                            }}
                          >
                            High Risk Scenario
                          </Button>
                        </span>
                      </MuiTooltip>
                      <Button 
                          onClick={runFireSimulation} 
                          variant="contained" 
                          color="success" 
                          startIcon={<PlayArrowIcon/>} 
                          disabled={isSimulationRunning()}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                          {simState === SIMULATION_STATES.FIRE_SPREADING ? "Fire Spreading..." : 
                           simState === SIMULATION_STATES.RECOVERING ? "Recovering..." : "Run Simulation"}
                      </Button>
                      <Button 
                          onClick={resetSimulation} 
                          variant="outlined" 
                          color="secondary" 
                          startIcon={<RefreshIcon/>} 
                          disabled={simState === SIMULATION_STATES.IDLE}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                          Reset
                      </Button>
                      <Button 
                          onClick={()=>setShowLegend(p=>!p)} 
                          variant="text" 
                          size="medium" 
                          startIcon={showLegend?<VisibilityOffIcon/>:<VisibilityIcon/>}
                          sx={{ borderRadius: 2, textTransform: 'none' }}
                      >
                          {showLegend?"Hide":"Show"} Legend
                      </Button>
                    </Box>

                    <Box sx={{
                        position:"relative", 
                        width:'100%', 
                        aspectRatio:'1/1', 
                        margin:"auto", 
                        border:"2px solid #e0e0e0", 
                        borderRadius:2, 
                        background:"#F0F8FF", 
                        overflow:'hidden',
                        boxShadow: 3
                    }}>
                        <canvas ref={simulationCanvasRef} width={600} height={600} style={{width:'100%',height:'100%',display:'block'}}/>
                        {showLegend && (
                            <Paper elevation={3} sx={{
                                position:"absolute",
                                top:16,
                                right:16,
                                background:"rgba(255,255,255,0.95)",
                                borderRadius:2,
                                p:2,
                                fontSize:"0.85rem"
                            }}>
                                <Typography variant="subtitle2" sx={{fontWeight:'bold', mb:1}}>Legend</Typography>
                                {Object.entries(TERRAIN_COLORS).filter(([k])=>k!=='default').map(([type,colors])=>(
                                    <Box key={type} sx={{mb:0.5, display:'flex', alignItems:'center'}}>
                                        <Typography variant="body2" sx={{textTransform:'capitalize', width:'70px'}}>{type}:</Typography>
                                        <Box sx={{display:'flex', gap:1}}>
                                            <MuiTooltip title="Unburned">
                                                <Box sx={{width:20,height:20,backgroundColor:colors.unburned,border:'1px solid #ddd',borderRadius:1}}/>
                                            </MuiTooltip>
                                            <MuiTooltip title="Burning">
                                                <Box sx={{width:20,height:20,backgroundColor:colors.burning,borderRadius:1}}/>
                                            </MuiTooltip>
                                            <MuiTooltip title="Burned">
                                                <Box sx={{width:20,height:20,backgroundColor:colors.burned,borderRadius:1}}/>
                                            </MuiTooltip>
                                        </Box>
                                    </Box>
                                ))}
                                {simState === SIMULATION_STATES.RECOVERING && (
                                    <Box sx={{mt:1, pt:1, borderTop:'1px solid #ddd'}}>
                                        <Typography variant="caption" color="text.secondary">
                                            Recovery in progress: {Math.round(recoveryProgress * 100)}%
                                        </Typography>
                                    </Box>
                                )}
                            </Paper>
                        )}
                    </Box>

                    {simResults && (
                        <Paper elevation={1} sx={{mt:2, p:2, borderRadius:2, bgcolor:'background.default'}}>
                            <Grid container spacing={2}>
                                <Grid xs={12} sm={4}>
                                    <Typography variant="body2" align="center">
                                        <strong>Final Burned Area:</strong><br/>
                                        {simResults.finalArea?.toFixed(2)??"?"} ha
                                    </Typography>
                                </Grid>
                                <Grid xs={12} sm={4}>
                                    <Typography variant="body2" align="center">
                                        <strong>Fire Intensity:</strong><br/>
                                        {simResults.intensity?.toFixed(2)??"?"} units
                                    </Typography>
                                </Grid>
                                <Grid xs={12} sm={4}>
                                    <Typography variant="body2" align="center">
                                        <strong>Duration:</strong><br/>
                                        {fireTimeline.length} steps
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Paper>
                    )}
                </CardContent></Card>
            </Grid>
        </Grid>
        
        <Card sx={{mt:2, backgroundColor: "rgba(232, 245, 233, 0.8)"}}><CardContent>
            <Typography variant="h6" component="h3" gutterBottom sx={{display:'flex', alignItems:'center'}}><InfoOutlinedIcon sx={{mr:1, color:'info.main'}}/>Simulation & Recovery Details</Typography>
            <Typography variant="body2" paragraph>
                This simulation demonstrates wildfire spread and ecosystem recovery with realistic timing. The recovery phase now shows gradual vegetation regrowth over {RECOVERY_TOTAL_STEPS} months, 
                with the NDVI chart updating in real-time to reflect the recovery progress. Temperature, humidity, elevation and slope parameters directly influence fire behavior and spread patterns.
            </Typography>
            <Box component="ul" sx={{pl:2}}>
                <li><Typography variant="body2"><strong>Fire Simulation:</strong> Models spread based on environmental conditions with realistic timing ({FIRE_ANIMATION_SPEED}ms per frame).</Typography></li>
                <li><Typography variant="body2"><strong>Recovery Animation:</strong> Shows gradual vegetation regrowth over {RECOVERY_TOTAL_STEPS} steps with slower timing ({RECOVERY_ANIMATION_SPEED}ms per step) for realistic recovery visualization.</Typography></li>
                <li><Typography variant="body2"><strong>NDVI Integration:</strong> Chart updates in real-time during recovery to show vegetation index improvements, synchronized with visual color changes on the grid.</Typography></li>
                <li><Typography variant="body2"><strong>Color Interpolation:</strong> Burned areas gradually transition from dark brown back to their natural green colors as recovery progresses.</Typography></li>
            </Box>
        </CardContent></Card>

      <Typography variant="caption" display="block" color="text.secondary" align="center" sx={{ mt:3, mb:1 }}>
        Wildfire & Ecosystem Recovery Simulation. Analyses use aggregated data and are illustrative. Actual ecological processes are highly complex.
      </Typography>
      </Container>

      <Modal open={showComparison} onClose={() => { setShowComparison(false); resetSimulation(); }}>
        <Box sx={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', bgcolor:'background.paper', p:3, boxShadow:24, maxWidth:1300 }}>
          <IconButton onClick={() => { setShowComparison(false); resetSimulation(); }} sx={{ position:'absolute', top:8, right:8 }}>
            <CloseIcon />
          </IconButton>
          <Typography variant="h6" sx={{ mb:1 }}>NDVI Comparison</Typography>
          <Typography variant="body2" sx={{ mb:2 }}>Left: Simulated NDVI. Right: Creek Fire NDVI (from CSV).</Typography>
          <Box sx={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'center', alignItems:'flex-start' }}>
            {/* Simulated NDVI Chart */}
            <Box sx={{ width:500, height:300, display:'flex', flexDirection:'column', alignItems:'center' }}>
              <Typography variant="subtitle1" sx={{ mb:1 }}>Simulated NDVI</Typography>
              <canvas ref={simCompChartRef} id="simNdviChart" width={500} height={300} style={{ width:'100%', height:'100%' }} />
            </Box>
            {/* Real NDVI Chart (from CSV) */}
            <Box sx={{ width:500, height:300, display:'flex', flexDirection:'column', alignItems:'center' }}>
              <Typography variant="subtitle1" sx={{ mb:1 }}>Creek Fire NDVI (CSV)</Typography>
              <canvas ref={realNdviChartRef} id="realNdviChart" width={500} height={300} style={{ width:'100%', height:'100%' }} />
            </Box>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};

export default Calculation;
