const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Import and use route modules
const tilesRouter = require('./routes/tiles');
const ndviRouter = require('./routes/ndvi');

// Mount routes - tiles router handles both monthly-tiles and eaton-fire-tiles
app.use('/api/monthly-tiles', tilesRouter);  // "/" route becomes "/api/monthly-tiles"
app.use('/api', tilesRouter);  // "/eaton-fire-tiles" route becomes "/api/eaton-fire-tiles"
app.use('/api', ndviRouter);

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!', message: err.message });
});

// Load NDVI data from all available fires and calculate averages
async function loadNDVIData() {
  try {
    const wildfireDataDir = path.join(__dirname, 'wildfire_data');
    const fires = await fs.readdir(wildfireDataDir, { withFileTypes: true });
    const fireNames = fires.filter(d => d.isDirectory()).map(d => d.name);
    
    let allFireData = [];
    
    // Load data from all fires
    for (const fireName of fireNames) {
      try {
        const filePath = path.join(wildfireDataDir, fireName, 'fuel_models', 'vegetation_indices_timeseries.csv');
        const data = await fs.readFile(filePath, 'utf8');
        const rows = data.split('\n').filter(row => row.trim());
        
        if (rows.length < 2) continue; // Skip if no data rows
        
        const header = rows[0].split(',').map(col => col.trim());
        const ndviColIndex = header.findIndex(col => col.toUpperCase() === 'NDVI');
        const dateColIndex = header.findIndex(col => col.toLowerCase() === 'date');
        const periodColIndex = header.findIndex(col => col.toLowerCase() === 'fire_period');

        if (ndviColIndex === -1) continue; // Skip if no NDVI column

        const fireData = rows.slice(1).map(row => {
          const cols = row.split(',').map(col => col.trim());
          const ndviValue = parseFloat(cols[ndviColIndex]);
          const date = dateColIndex !== -1 ? cols[dateColIndex] : null;
          const period = periodColIndex !== -1 ? cols[periodColIndex] : 'unknown';
          
          return {
            fire: fireName,
            ndvi: ndviValue,
            date: date,
            period: period,
            timestamp: date ? new Date(date).getTime() : null
          };
        }).filter(item => !isNaN(item.ndvi) && item.date);

        allFireData = allFireData.concat(fireData);
      } catch (err) {
        console.warn(`Could not load data for fire ${fireName}:`, err.message);
      }
    }

    if (allFireData.length === 0) {
      console.warn('No valid NDVI data found from any fire, using mock data');
      return generateMockData();
    }

    // Group data by period and calculate statistics
    const periodData = {
      pre_fire: allFireData.filter(d => d.period === 'pre_fire'),
      during_fire: allFireData.filter(d => d.period === 'during_fire'),
      post_fire: allFireData.filter(d => d.period === 'post_fire')
    };

    // Calculate average NDVI values for each period
    const avgNDVI = {
      pre_fire: periodData.pre_fire.length > 0 ? 
        periodData.pre_fire.reduce((sum, d) => sum + d.ndvi, 0) / periodData.pre_fire.length : 0.7,
      during_fire: periodData.during_fire.length > 0 ? 
        periodData.during_fire.reduce((sum, d) => sum + d.ndvi, 0) / periodData.during_fire.length : 0.2,
      post_fire: periodData.post_fire.length > 0 ? 
        periodData.post_fire.reduce((sum, d) => sum + d.ndvi, 0) / periodData.post_fire.length : 0.6
    };

    // Generate realistic timeline with gradual recovery
    const timelineLength = 36; // 3 years of monthly data
    const preFireMonths = 6;
    const fireMonths = 3;
    const recoveryMonths = timelineLength - preFireMonths - fireMonths;

    const values = [];
    const labels = [];
    const periods = [];
    const dates = [];

    const baseDate = new Date('2021-01-01');

    // Pre-fire period - stable high vegetation
    for (let i = 0; i < preFireMonths; i++) {
      const variation = (Math.random() - 0.5) * 0.1; // Small random variation
      values.push(Math.max(0, Math.min(1, avgNDVI.pre_fire + variation)));
      const currentDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
      labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      periods.push('pre_fire');
      dates.push(currentDate.toISOString().split('T')[0]);
    }

    // Fire period - rapid decline
    const fireStartNDVI = values[values.length - 1];
    for (let i = 0; i < fireMonths; i++) {
      const progress = (i + 1) / fireMonths;
      const currentNDVI = fireStartNDVI * (1 - progress) + avgNDVI.during_fire * progress;
      values.push(Math.max(0, currentNDVI));
      const currentDate = new Date(baseDate.getTime() + (preFireMonths + i) * 30 * 24 * 60 * 60 * 1000);
      labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      periods.push('during_fire');
      dates.push(currentDate.toISOString().split('T')[0]);
    }

    // Recovery period - gradual exponential recovery
    const recoveryStartNDVI = values[values.length - 1];
    const targetRecoveryNDVI = avgNDVI.post_fire;
    const recoveryRate = 0.15; // Recovery rate parameter

    for (let i = 0; i < recoveryMonths; i++) {
      const monthsIntoRecovery = i + 1;
      // Exponential recovery curve: approaches target asymptotically
      const recoveryProgress = 1 - Math.exp(-recoveryRate * monthsIntoRecovery);
      const currentNDVI = recoveryStartNDVI + (targetRecoveryNDVI - recoveryStartNDVI) * recoveryProgress;
      
      // Add some natural variation
      const variation = (Math.random() - 0.5) * 0.05;
      values.push(Math.max(0, Math.min(1, currentNDVI + variation)));
      
      const currentDate = new Date(baseDate.getTime() + (preFireMonths + fireMonths + i) * 30 * 24 * 60 * 60 * 1000);
      labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      periods.push('post_fire');
      dates.push(currentDate.toISOString().split('T')[0]);
    }

    return {
      values,
      labels,
      periods,
      dates,
      fireStartIndex: preFireMonths,
      recoveryStartIndex: preFireMonths + fireMonths,
      averageNDVI: avgNDVI,
      dataSourceCount: fireNames.length,
      totalDataPoints: allFireData.length
    };

  } catch (err) {
    console.error('Error loading NDVI data from all fires:', err);
    return generateMockData();
  }
}

// Generate mock data as fallback
function generateMockData() {
  const timelineLength = 36;
  const preFireMonths = 6;
  const fireMonths = 3;
  const recoveryMonths = timelineLength - preFireMonths - fireMonths;
  
  const values = [];
  const labels = [];
  const periods = [];
  const dates = [];
  const baseDate = new Date('2021-01-01');

  // Pre-fire: stable around 0.7
  for (let i = 0; i < preFireMonths; i++) {
    values.push(0.65 + Math.random() * 0.1);
    const currentDate = new Date(baseDate.getTime() + i * 30 * 24 * 60 * 60 * 1000);
    labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    periods.push('pre_fire');
    dates.push(currentDate.toISOString().split('T')[0]);
  }

  // Fire: decline to 0.2
  for (let i = 0; i < fireMonths; i++) {
    const progress = (i + 1) / fireMonths;
    values.push(0.7 * (1 - progress) + 0.2 * progress);
    const currentDate = new Date(baseDate.getTime() + (preFireMonths + i) * 30 * 24 * 60 * 60 * 1000);
    labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    periods.push('during_fire');
    dates.push(currentDate.toISOString().split('T')[0]);
  }

  // Recovery: gradual exponential recovery
  for (let i = 0; i < recoveryMonths; i++) {
    const recoveryProgress = 1 - Math.exp(-0.15 * (i + 1));
    const currentNDVI = 0.2 + (0.6 - 0.2) * recoveryProgress;
    values.push(currentNDVI + (Math.random() - 0.5) * 0.05);
    const currentDate = new Date(baseDate.getTime() + (preFireMonths + fireMonths + i) * 30 * 24 * 60 * 60 * 1000);
    labels.push(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    periods.push('post_fire');
    dates.push(currentDate.toISOString().split('T')[0]);
  }

  return {
    values,
    labels,
    periods,
    dates,
    fireStartIndex: preFireMonths,
    recoveryStartIndex: preFireMonths + fireMonths,
    averageNDVI: { pre_fire: 0.7, during_fire: 0.2, post_fire: 0.6 },
    dataSourceCount: 0,
    totalDataPoints: 0
  };
}

// Simulation parameters endpoint
app.get('/api/simulation/parameters', async (req, res) => {
  try {
    const ndviData = await loadNDVIData();
    res.json({
      elevation: 1000,
      slope: 10,
      temperature: 30,
      humidity: 20,
      ndviInitial: ndviData.values[0] || 0.2,
      ndviFinal: ndviData.values[ndviData.values.length - 1] || 0.8
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get parameters', message: err.message });
  }
});

// NDVI prediction endpoint
app.get('/api/prediction/ndvi', async (req, res) => {
  try {
    const ndviData = await loadNDVIData();
    res.json({
      values: ndviData.values,
      labels: ndviData.labels,
      periods: ndviData.periods,
      dates: ndviData.dates,
      fireStartIndex: ndviData.fireStartIndex,
      recoveryStartIndex: ndviData.recoveryStartIndex,
      metadata: {
        totalPoints: ndviData.values.length,
        preFirePoints: ndviData.periods.filter(p => p === 'pre_fire').length,
        duringFirePoints: ndviData.periods.filter(p => p === 'during_fire').length,
        postFirePoints: ndviData.periods.filter(p => p === 'post_fire').length,
        timeSpan: ndviData.dates.length > 0 ? {
          start: ndviData.dates[0],
          end: ndviData.dates[ndviData.dates.length - 1]
        } : null,
        averageNDVI: ndviData.averageNDVI,
        dataSourceCount: ndviData.dataSourceCount,
        totalDataPoints: ndviData.totalDataPoints
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get NDVI data', message: err.message });
  }
});

// Fire simulation endpoint
app.post('/api/simulation/run', (req, res) => {
  try {
    const { params, duration } = req.body;
    const gridSize = 100;
    const timeline = [];
    
    // Start fire at center
    const centerX = Math.floor(gridSize / 2);
    const centerY = Math.floor(gridSize / 2);
    let burning = new Set([`${centerX},${centerY}`]);
    let burned = new Set();

    // Run simulation steps
    for (let t = 0; t < duration; t++) {
      timeline.push(Array.from(burning));
      const newBurning = new Set();

      burning.forEach(cell => {
        const [x, y] = cell.split(',').map(Number);
        burned.add(cell);

        // Spread probability factors
        const slopeFactor = params.slope / 50; // 0-45° -> up to ~0.9
        const elevationEffect = -params.elevation / 5000; // higher elevation slows spread
        const tempFactor = params.temperature / 100;
        const humidityEffect = params.humidity / 100; // Directly proportional to humidity (0.0 to 1.0)
        const baseProb = 0.3;

        // Check neighbors
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
            
            const neighborKey = `${nx},${ny}`;
            if (!burned.has(neighborKey) && !burning.has(neighborKey)) {
              // Calculate spread probability using terrain and climate factors
              let prob = baseProb + slopeFactor + elevationEffect + tempFactor - humidityEffect;

              if (Math.random() < Math.min(0.95, Math.max(0.05, prob))) {
                newBurning.add(neighborKey);
              }
            }
          }
        }
      });

      burning = newBurning;
      if (burning.size === 0) break;
    }

    res.json({
      timeline,
      finalArea: burned.size * 0.01, // hectares
      intensity: (params.slope * 0.1 + params.temperature * 0.05) * (1 - params.humidity / 100) * (1 - params.elevation / 10000),
      burnedCells: burned.size
    });
  } catch (err) {
    res.status(500).json({ error: 'Simulation failed', message: err.message });
  }
});

// Wildfire Data API
const wildfireDataDir = path.join(__dirname, 'wildfire_data');
const allowedCategories = [
  'satellite', 'weather', 'topography', 'fire_detection', 'fuel_models', 'metadata'
];

// List all available fires
app.get('/api/wildfire/fires', async (req, res) => {
  try {
    const fires = await fs.readdir(wildfireDataDir, { withFileTypes: true });
    const fireNames = fires.filter(d => d.isDirectory()).map(d => d.name);
    res.json(fireNames);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list fires', message: err.message });
  }
});

// List categories and files for a fire
app.get('/api/wildfire/:fire', async (req, res) => {
  try {
    const fireDir = path.join(wildfireDataDir, req.params.fire);
    const entries = await fs.readdir(fireDir, { withFileTypes: true });
    const result = {};
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const files = await fs.readdir(path.join(fireDir, entry.name));
        result[entry.name] = files;
      } else if (entry.isFile()) {
        if (!result.root) result.root = [];
        result.root.push(entry.name);
      }
    }
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: 'Fire not found', message: err.message });
  }
});

// Fetch a root-level file (JSON, CSV, GeoJSON, or text)
app.get('/api/wildfire/:fire/root/:filename', async (req, res) => {
  try {
    const { fire, filename } = req.params;
    console.log(`[DEBUG] /api/wildfire/:fire/root/:filename called with fire=`, fire, 'filename=', filename);
    // Path traversal protection
    if (filename.includes('..') || fire.includes('..')) {
      console.log('[DEBUG] Path traversal detected:', fire, filename);
      return res.status(400).json({ error: 'Invalid path' });
    }
    const filePath = path.join(wildfireDataDir, fire, filename);
    console.log('[DEBUG] Attempting to read file:', filePath);
    const data = await fs.readFile(filePath, 'utf8');
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.json' || ext === '.geojson') {
      res.json(JSON.parse(data));
    } else if (ext === '.csv') {
      // Parse CSV to JSON
      const [header, ...rows] = data.split('\n').filter(r => r.trim());
      const cols = header.split(',');
      const jsonRows = rows.map(row => {
        const vals = row.split(',');
        const obj = {};
        cols.forEach((col, i) => { obj[col] = vals[i]; });
        return obj;
      });
      res.json(jsonRows);
    } else {
      res.type('text/plain').send(data);
    }
  } catch (err) {
    console.log('[DEBUG] Error in /api/wildfire/:fire/root/:filename:', err);
    res.status(404).json({ error: 'File not found', message: err.message });
  }
});

// Fetch a specific file (JSON, CSV, GeoJSON, or text)
app.get('/api/wildfire/:fire/:category/:filename', async (req, res) => {
  try {
    const { fire, category, filename } = req.params;
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    // Path traversal protection
    if (filename.includes('..') || fire.includes('..') || category.includes('..')) {
      return res.status(400).json({ error: 'Invalid path' });
    }
    const filePath = path.join(wildfireDataDir, fire, category, filename);
    const ext = path.extname(filename).toLowerCase();
    const data = await fs.readFile(filePath, 'utf8');
    if (ext === '.json' || ext === '.geojson') {
      res.json(JSON.parse(data));
    } else if (ext === '.csv') {
      // Parse CSV to JSON
      const [header, ...rows] = data.split('\n').filter(r => r.trim());
      const cols = header.split(',');
      const jsonRows = rows.map(row => {
        const vals = row.split(',');
        const obj = {};
        cols.forEach((col, i) => { obj[col] = vals[i]; });
        return obj;
      });
      res.json(jsonRows);
    } else {
      res.type('text/plain').send(data);
    }
  } catch (err) {
    res.status(404).json({ error: 'File not found', message: err.message });
  }
});

// List files in a category for a fire
app.get('/api/wildfire/:fire/:category', async (req, res) => {
  try {
    const { fire, category } = req.params;
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    const dir = path.join(wildfireDataDir, fire, category);
    const files = await fs.readdir(dir);
    res.json(files);
  } catch (err) {
    res.status(404).json({ error: 'Category not found', message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
