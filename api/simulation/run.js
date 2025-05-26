module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
        const windFactor = params.windSpeed * 0.02;
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
              // Calculate spread probability with corrected humidity effect
              let prob = baseProb + windFactor + tempFactor - humidityEffect;
              
              // Wind direction effect
              const angle = Math.atan2(dy, dx);
              const windAngle = params.windDirection * Math.PI / 180;
              const windAlignment = Math.cos(angle - windAngle);
              prob *= (1 + windAlignment * windFactor);

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

    res.status(200).json({
      timeline,
      finalArea: burned.size * 0.01, // hectares
      intensity: (params.windSpeed * 0.2 + params.temperature * 0.05) * (1 - params.humidity / 100),
      burnedCells: burned.size
    });
  } catch (err) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: 'Simulation failed', message: err.message });
  }
}
