# backend/scripts/generate_eaton_tiles.py
import ee, json, os
from datetime import datetime

# ---------- GEE auth ----------
SERVICE_ACCOUNT = "earthengine-access@gen-lang-client-0853931727.iam.gserviceaccount.com"
KEY_FILE        = "./credentials.json"
ee.Initialize(ee.ServiceAccountCredentials(SERVICE_ACCOUNT, KEY_FILE))

# ---------- Study window ----------
# Eaton Fire ignition: 2025-01-07, containment: 2025-01-31 :contentReference[oaicite:0]{index=0}
# One year before → one year after
START_DATE  = "2024-01-01"
NUM_MONTHS  = 24                   # 2024-01 … 2025-12
FIRE_START  = "2025-01"
FIRE_END    = "2025-02"

# Bounding box around Eaton Canyon (Altadena / Mt Wilson foothills)
# centre coords 34.205 N, -118.088 W :contentReference[oaicite:1]{index=1}
REGION = ee.Geometry.Rectangle([-118.25, 34.12, -117.93, 34.32])

# ---------- Visual parameters ----------
RGB_VIS = dict(bands=["B4", "B3", "B2"], min=0, max=0.3, gamma=1.4)

def mask_s2(img):
    qa = img.select("QA60")
    cloud  = 1 << 10
    cirrus = 1 << 11
    mask = qa.bitwiseAnd(cloud).eq(0).And(qa.bitwiseAnd(cirrus).eq(0))
    return img.updateMask(mask).divide(1e4).copyProperties(img, ["system:time_start"])

s2 = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(START_DATE, "2026-01-01")
        .filterBounds(REGION)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        .map(mask_s2))

months, tiles = ee.List.sequence(0, NUM_MONTHS-1), []

for i in range(NUM_MONTHS):
    m_start = ee.Date(START_DATE).advance(i, "month")
    m_end   = m_start.advance(1, "month")
    date_str = m_start.format("YYYY-MM").getInfo()

    comp = s2.filterDate(m_start, m_end).median()
    rgb  = comp.visualize(**RGB_VIS)
    tile = dict(index=i, date=date_str,
                tileUrl=ee.data.getMapId({"image": rgb})["tile_fetcher"].url_format)

    # --- Fire overlay only for active-burn months ---
    if FIRE_START <= date_str <= FIRE_END:
        nbr  = comp.normalizedDifference(["B8", "B12"])
        fire = nbr.lt(0.1).selfMask().visualize(palette=["red"])
        tile["fireUrl"] = ee.data.getMapId({"image": fire})["tile_fetcher"].url_format

    # Land-cover (static)
    try:
        lc_img = ee.ImageCollection("ESA/WorldCover/v100").first() \
                    .select("Map") \
                    .visualize(min=10, max=100,
                               palette=["006400","ffbb22","ffff4c","f096ff","fa0000",
                                        "b4b4b4","f0f0f0","0064c8","0096a0","00cf75","ffffff"])
        tile["landCoverUrl"] = ee.data.getMapId({"image": lc_img})["tile_fetcher"].url_format
    except Exception as e:
        print(f"Land-cover failed {date_str}: {e}")

    # Precipitation (CHIRPS daily → monthly sum)
    try:
        pr = (ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
                .filterDate(m_start, m_end).sum()
                .visualize(min=0, max=300, palette=["white","blue","purple"]))
        tile["precipUrl"] = ee.data.getMapId({"image": pr})["tile_fetcher"].url_format
    except Exception: pass

    # AOD (MODIS 08 M3)
    try:
        aod = (ee.ImageCollection("MODIS/061/MOD08_M3")
                 .filterDate(m_start, m_end)
                 .select("Aerosol_Optical_Depth_Land_Ocean_Mean_Mean")
                 .mean()
                 .visualize(min=0, max=0.5,
                            palette=["white","yellow","orange","red"]))
        tile["aodUrl"] = ee.data.getMapId({"image": aod})["tile_fetcher"].url_format
    except Exception: pass

    # LST (MODIS 11A2, °C)
    try:
        lst = (ee.ImageCollection("MODIS/061/MOD11A2")
                 .filterDate(m_start, m_end)
                 .select("LST_Day_1km").mean()
                 .multiply(0.02).subtract(273.15)
                 .visualize(min=0, max=40,
                            palette=["blue","cyan","yellow","red"]))
        tile["lstUrl"] = ee.data.getMapId({"image": lst})["tile_fetcher"].url_format
    except Exception: pass

    # TerraClimate monthly precipitation
    try:
        clim = (ee.ImageCollection("IDAHO_EPSCOR/TERRACLIMATE")
                  .filterDate(m_start, m_end).select("pr").mean()
                  .visualize(min=0, max=300,
                             palette=["white","green","blue"]))
        tile["climateUrl"] = ee.data.getMapId({"image": clim})["tile_fetcher"].url_format
    except Exception: pass

    tiles.append(tile)

outfile = "./data/eaton-fire_tiles.json"
os.makedirs(os.path.dirname(outfile), exist_ok=True)
with open(outfile, "w") as f:
    json.dump(tiles, f, indent=2)

print(f"🎉  Saved {len(tiles)} monthly tiles → {outfile}")
