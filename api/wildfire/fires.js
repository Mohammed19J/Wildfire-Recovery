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

  const baseDir = process.cwd();
  console.log('[fires.js] process.cwd():', baseDir);

  // Path to the directory where Vercel copies the included files
  // Assuming 'backend/wildfire_data' from project root is copied as 'backend/wildfire_data' in lambda root
  const wildfireDataDir = path.join(baseDir, 'backend', 'wildfire_data');
  console.log('[fires.js] Attempting to access wildfireDataDir:', wildfireDataDir);

  try {
    // Check if the base 'backend' directory exists and list its contents
    const backendDir = path.join(baseDir, 'backend');
    try {
      await fs.access(backendDir);
      console.log(`[fires.js] Directory ${backendDir} exists.`);
      const backendContents = await fs.readdir(backendDir);
      console.log(`[fires.js] Contents of ${backendDir}:`, backendContents);
    } catch (e) {
      console.error(`[fires.js] Directory ${backendDir} does NOT exist or cannot be accessed:`, e.message);
      // If 'backend' dir itself is missing, wildfireDataDir will also fail.
    }

    // Check if the target 'wildfire_data' directory exists
    await fs.access(wildfireDataDir);
    console.log(`[fires.js] Directory ${wildfireDataDir} exists. Reading contents...`);
    
    const items = await fs.readdir(wildfireDataDir, { withFileTypes: true });
    console.log('[fires.js] Raw items in wildfireDataDir:', items.map(f => ({ name: f.name, isDir: f.isDirectory() })));
    
    const fireNames = items.filter(d => d.isDirectory()).map(d => d.name);
    console.log('[fires.js] Filtered fireNames:', fireNames);

    if (fireNames.length === 0) {
        console.warn('[fires.js] No directories found in wildfireDataDir. This might be an issue with includeFiles or the directory structure. Returning mock data.');
        // Using a distinct mock data set to indicate this specific scenario
        return res.status(200).json(['Mock_Fire_Empty_Dir_A', 'Mock_Fire_Empty_Dir_B']);
    }
    res.status(200).json(fireNames);

  } catch (accessErr) {
    console.error(`[fires.js] Error accessing ${wildfireDataDir} or reading its contents:`, accessErr.message);
    console.error('[fires.js] Full error stack for accessErr:', accessErr.stack);
    console.warn('[fires.js] Wildfire data directory not found or error during processing, returning fallback mock data due to accessErr.');
    // Fallback mock data, similar to what worked locally
    return res.status(200).json(['August_Complex_Fire_Mock', 'Bootleg_Fire_Mock', 'Camp_Fire_Mock']);
  }
}
