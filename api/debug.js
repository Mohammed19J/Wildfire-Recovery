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

  const debugInfo = {
    message: 'Debug API endpoint working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL,
    vercelEnv: process.env.VERCEL_ENV || 'none',
    url: req.url,
    method: req.method,
    headers: Object.keys(req.headers),
    cwd: process.cwd(),
    platform: process.platform,
    nodeVersion: process.version
  };

  res.status(200).json(debugInfo);
}
