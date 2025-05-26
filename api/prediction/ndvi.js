const fs = require('fs').promises;
const path = require('path');

// Load NDVI data from all available fires and calculate averages
async function loadNDVIData() {
  try {
    const dataDir = path.join(process.cwd(), 'backend', 'data');
    const files = await fs.readdir(dataDir);
    const ndviFiles = files.filter(file => file.includes('ndvi_timeseries.csv'));
    
    let allFireData = [];
    
    // Load data from all NDVI files
    for (const fileName of ndviFiles) {
      try {
        const fireName = fileName.replace('_ndvi_timeseries.csv', '');
        const filePath = path.join(dataDir, fileName);
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
        console.warn(`Could not load data for fire ${fileName}:`, err.message);
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
    const ndviData = await loadNDVIData();
    res.status(200).json({
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
    console.error('Error in NDVI prediction:', err);
    res.status(500).json({ error: 'Failed to get NDVI data', message: err.message });
  }
}
