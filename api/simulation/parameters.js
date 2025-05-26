const fs = require('fs').promises;
const path = require('path');

// Load NDVI data from all available fires and calculate averages
async function loadNDVIData() {
  try {
    const wildfireDataDir = path.join(process.cwd(), 'backend', 'wildfire_data');
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

    return {
      windSpeed: 10,
      windDirection: 45,
      temperature: 30,
      humidity: 20,
      ndviInitial: avgNDVI.pre_fire || 0.7,
      ndviFinal: avgNDVI.post_fire || 0.6
    };

  } catch (err) {
    console.error('Error loading NDVI data from all fires:', err);
    return {
      windSpeed: 10,
      windDirection: 45,
      temperature: 30,
      humidity: 20,
      ndviInitial: 0.7,
      ndviFinal: 0.6
    };
  }
}

function generateMockData() {
  return {
    windSpeed: 10,
    windDirection: 45,
    temperature: 30,
    humidity: 20,
    ndviInitial: 0.7,
    ndviFinal: 0.6
  };
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const parameters = await loadNDVIData();
    res.status(200).json(parameters);
  } catch (err) {
    console.error('Error getting simulation parameters:', err);
    res.status(500).json({ error: 'Failed to get parameters', message: err.message });
  }
}
