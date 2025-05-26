const fs = require('fs').promises;
const path = require('path');

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
    // For Vercel deployment, return mock data since file access is problematic
    if (process.env.VERCEL) {
      console.log('[monthly-tiles.js] Running on Vercel, returning mock data');
      const mockTiles = [
        {
          date: "2023-01-01",
          tileUrl: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-tile-1/tiles/{z}/{x}/{y}",
          overlays: {
            fire: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-fire-1/tiles/{z}/{x}/{y}",
            landCover: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-landcover-1/tiles/{z}/{x}/{y}"
          }
        },
        {
          date: "2023-02-01", 
          tileUrl: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-tile-2/tiles/{z}/{x}/{y}",
          overlays: {
            fire: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-fire-2/tiles/{z}/{x}/{y}",
            landCover: "https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/mock-landcover-2/tiles/{z}/{x}/{y}"
          }
        }
      ];
      return res.status(200).json(mockTiles);
    }

    const filePath = path.join(process.cwd(), 'backend', 'data', 'monthly_tiles.json');
    const data = await fs.readFile(filePath, 'utf8');
    const tiles = JSON.parse(data);
    res.status(200).json(tiles);
  } catch (err) {
    console.error('Error reading monthly tiles:', err);
    res.status(500).json({ error: 'Failed to read monthly tile data', message: err.message });
  }
}
