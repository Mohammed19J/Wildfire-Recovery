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
    const filePath = path.join(process.cwd(), 'backend', 'data', 'eaton-fire_tiles.json');
    const data = await fs.readFile(filePath, 'utf8');
    const tiles = JSON.parse(data);
    res.status(200).json(tiles);
  } catch (err) {
    console.error('Error reading eaton fire tiles:', err);
    res.status(500).json({ error: 'Failed to read eaton-fire tile data', message: err.message });
  }
}
