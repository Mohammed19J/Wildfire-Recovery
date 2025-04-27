import ee
import json
from datetime import datetime

# authenticate and Initialize
service_account = 'earthengine-access@gen-lang-client-0853931727.iam.gserviceaccount.com'
key_file = './credentials.json'

credentials = ee.ServiceAccountCredentials(service_account, key_file)
ee.Initialize(credentials)

# Set Parameters
region = ee.Geometry.Rectangle([-119.3, 36.0, -118.5, 36.5])
start_date = '2019-01-01'
num_months = 48

vis_params = {
    'bands': ['B4', 'B3', 'B2'],
    'min': 0.0,
    'max': 0.3,
    'gamma': 1.4
}

# Sentinel-2 Cloud Mask Function
def mask_s2(img):
    qa = img.select('QA60')
    cloud = 1 << 10
    cirrus = 1 << 11
    mask = qa.bitwiseAnd(cloud).eq(0).And(qa.bitwiseAnd(cirrus).eq(0))
    return img.updateMask(mask).divide(10000).copyProperties(img, ['system:time_start'])

s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
    .filterDate(start_date, '2023-01-01') \
    .filterBounds(region) \
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30)) \
    .map(mask_s2)

# Monthly Composites with Fire Overlay
months = ee.List.sequence(0, num_months - 1)

monthly_list = []

for i in range(num_months):
    m_start = ee.Date(start_date).advance(i, 'month')
    m_end = m_start.advance(1, 'month')
    comp = s2.filterDate(m_start, m_end).median()
    vis = comp.visualize(**vis_params)

    date_str = m_start.format('YYYY-MM').getInfo()

    map_id_dict = ee.data.getMapId({"image": vis})
    tile_dict = {
        "index": i,
        "date": date_str,
        "tileUrl": map_id_dict['tile_fetcher'].url_format
    }

    # Only add fire overlay if date is within fire window
    if "2020-08" <= date_str <= "2020-12":
        nbr = comp.normalizedDifference(['B8', 'B12'])
        fire = nbr.lt(0.1).selfMask().visualize(palette=['red'])
        fire_map_id = ee.data.getMapId({"image": fire})
        tile_dict["fireUrl"] = fire_map_id["tile_fetcher"].url_format

    monthly_list.append(tile_dict)

# Save metadata to JSON file
with open('./data/monthly_tiles.json', 'w') as f:
    json.dump(monthly_list, f, indent=2)

print(f"Saved {len(monthly_list)} monthly tiles to data/monthly_tiles.json")
