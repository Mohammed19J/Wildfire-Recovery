import ee
import sys
import json

ee.Initialize(project='gen-lang-client-0853931727')  # Use your project ID

region = ee.Geometry.Rectangle([-119.3, 36.0, -118.5, 36.5])
# Define the region of interest (ROI) for NDVI calculation
def get_ndvi_tile(start, end):
    image = ee.ImageCollection("MODIS/006/MOD13Q1") \
        .filterDate(start, end) \
        .filterBounds(region) \
        .select("NDVI") \
        .mean()

    vis_params = {"min": 0, "max": 9000, "palette": ["white", "green"]}
    map_id = image.getMapId(vis_params)
    return map_id["tile_fetcher"].url_format

start = sys.argv[1]
end = sys.argv[2]

try:
    tile_url = get_ndvi_tile(start, end)
    print(json.dumps({"tileUrl": tile_url}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
