const ee = require("@google/earthengine");
const privateKey = require("../credentials.json");

const region = ee.Geometry.Rectangle([-119.3, 36.0, -118.5, 36.5]);
// Define the region of interest (ROI) as a rectangle
function initAuth() {
  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(privateKey, () => {
      ee.initialize(null, null, resolve, reject);
    }, reject);
  });
}
// Initialize the Earth Engine API with the provided credentials
async function getNDVITileURL(start, end) {
  await initAuth();

  const image = ee.ImageCollection("MODIS/006/MOD13Q1")
    .filterDate(start, end)
    .filterBounds(region)
    .select("NDVI")
    .mean();

  const visParams = { min: 0, max: 9000, palette: ["white", "green"] };
  const mapId = await image.getMap(visParams);
  return mapId.urlFormat;
}

module.exports = { getNDVITileURL };
