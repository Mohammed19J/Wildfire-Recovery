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

s2 = (
    ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(start_date, '2023-01-01')
      .filterBounds(region)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
      .map(mask_s2)
)

months = ee.List.sequence(0, num_months - 1)
monthly_list = []

for i in range(num_months):
    m_start = ee.Date(start_date).advance(i, 'month')
    m_end = m_start.advance(1, 'month')

    # Base Sentinel-2 composite
    comp = s2.filterDate(m_start, m_end).median()
    vis = comp.visualize(**vis_params)

    date_str = m_start.format('YYYY-MM').getInfo()
    map_id_dict = ee.data.getMapId({"image": vis})

    tile_dict = {
        "index": i,
        "date": date_str,
        "tileUrl": map_id_dict['tile_fetcher'].url_format
    }

    # 1) Fire overlay (unchanged)
    if "2020-08" <= date_str <= "2020-12":
        nbr = comp.normalizedDifference(['B8', 'B12'])
        fire = nbr.lt(0.1).selfMask().visualize(palette=['red'])
        fire_map_id = ee.data.getMapId({"image": fire})
        tile_dict["fireUrl"] = fire_map_id["tile_fetcher"].url_format

    # 2) Land Cover — fixed to pull the single ESA/WorldCover/v100 image
    try:
        lc_img = ee.ImageCollection("ESA/WorldCover/v100").first()
        # visualize the 'Map' band (class values 10–100)
        lc_vis = lc_img.select('Map').visualize(
            min=10,
            max=100,
            palette=[
                '006400','ffbb22','ffff4c','f096ff','fa0000',
                'b4b4b4','f0f0f0','0064c8','0096a0','00cf75','ffffff'
            ]
        )
        lc_map_id = ee.data.getMapId({"image": lc_vis})
        tile_dict["landCoverUrl"] = lc_map_id["tile_fetcher"].url_format
    except Exception as e:
        print(f"LandCover failed for {date_str}: {e}")

    # 3) Weather (CHIRPS Precipitation)
    try:
        precip_img = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY") \
                        .filterDate(m_start, m_end) \
                        .sum()
        precip_vis = precip_img.visualize(
            min=0,
            max=300,
            palette=['white','blue','purple']
        )
        precip_map_id = ee.data.getMapId({"image": precip_vis})
        tile_dict["precipUrl"] = precip_map_id["tile_fetcher"].url_format
    except Exception:
        pass

    # 4) Atmospheric (MODIS AOD)
    try:
        aod_img = (
            ee.ImageCollection("MODIS/061/MOD08_M3")
              .filterDate(m_start, m_end)
              .select("Aerosol_Optical_Depth_Land_Ocean_Mean_Mean")
              .mean()
        )
        aod_vis = aod_img.visualize(
            min=0,
            max=0.5,
            palette=['white','yellow','orange','red']
        )
        aod_map_id = ee.data.getMapId({"image": aod_vis})
        tile_dict["aodUrl"] = aod_map_id["tile_fetcher"].url_format
    except Exception:
        pass

    # 5) Surface Temperature (MODIS LST Day)
    try:
        lst_img = (
            ee.ImageCollection("MODIS/061/MOD11A2")
              .filterDate(m_start, m_end)
              .select("LST_Day_1km")
              .mean()
              .multiply(0.02)
              .subtract(273.15)
        )
        lst_vis = lst_img.visualize(
            min=0,
            max=40,
            palette=['blue','cyan','yellow','red']
        )
        lst_map_id = ee.data.getMapId({"image": lst_vis})
        tile_dict["lstUrl"] = lst_map_id["tile_fetcher"].url_format
    except Exception:
        pass

    # 6) Climate (TerraClimate precipitation)
    try:
        clim_img = ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE") \
                        .filterDate(m_start, m_end) \
                        .select("pr") \
                        .mean()
        clim_vis = clim_img.visualize(
            min=0,
            max=300,
            palette=['white','green','blue']
        )
        clim_map_id = ee.data.getMapId({"image": clim_vis})
        tile_dict["climateUrl"] = clim_map_id["tile_fetcher"].url_format
    except Exception:
        pass

    monthly_list.append(tile_dict)

# Write out
with open('./data/monthly_tiles.json', 'w') as f:
    json.dump(monthly_list, f, indent=2)

print(f"Saved {len(monthly_list)} monthly tiles to data/monthly_tiles.json")
