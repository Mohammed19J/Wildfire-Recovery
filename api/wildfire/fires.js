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
  }  try {
    const wildfireDataDir = path.join(process.cwd(), 'backend', 'wildfire_data');
    
    // Check if directory exists
    try {
      await fs.access(wildfireDataDir);
      const fires = await fs.readdir(wildfireDataDir, { withFileTypes: true });
      const fireNames = fires.filter(d => d.isDirectory()).map(d => d.name);
      res.status(200).json(fireNames);
    } catch (accessErr) {
      console.warn('Wildfire data directory not found, returning mock data');
      return res.status(200).json(['August_Complex_Fire', 'Bootleg_Fire', 'Camp_Fire', 'Creek_Fire', 'Dixie_Fire', 'East_Troublesome_Fire']);
    }
  } catch (err) {
    console.error('Error listing fires:', err);
    res.status(500).json({ error: 'Failed to list fires', message: err.message });
  }
}
