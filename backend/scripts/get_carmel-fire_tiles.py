import ee
import json
from datetime import datetime

# ── Authenticate & initialize ────────────────────────────────────────────────
service_account = 'earthengine-access@gen-lang-client-0853931727.iam.gserviceaccount.com'
key_file        = './credentials.json'
credentials     = ee.ServiceAccountCredentials(service_account, key_file)
ee.Initialize(credentials)

# ── Region & date range ──────────────────────────────────────────────────────
region     = ee.Geometry.Rectangle([34.8, 32.6, 35.2, 33.0])
start_date = ee.Date('2010-11-25')
end_date   = ee.Date('2010-12-10').advance(1, 'day')  # include Dec 10

# ── Visualization parameters for MODIS true-color ─────────────────────────────
vis_params = {
    'bands': ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'],  # R, NIR, G
    'min':   0.0,
    'max':   0.3,
    'gamma': 1.4
}

# ── Load the MODIS Surface Reflectance collection ──────────────────────────────
modis = (
    ee.ImageCollection('MODIS/006/MOD09GA')
      .filterDate(start_date, end_date)
      .filterBounds(region)
)

# ── Compute how many days in the range ────────────────────────────────────────
num_days = end_date.difference(start_date, 'day').getInfo()

tiles = []

for i in range(num_days):
    day_start = start_date.advance(i, 'day')
    day_end   = day_start.advance(1, 'day')
    date_str  = day_start.format('YYYY-MM-dd').getInfo()

    # ─ Check for any scenes that day
    daily = modis.filterDate(day_start, day_end)
    count = daily.size().getInfo()
    if count == 0:
        print(f"{date_str}: no MODIS scenes, skipping.")
        tiles.append({
            'index':   i,
            'date':    date_str,
            'tileUrl': None
        })
        continue

    # ─ Build the daily median composite & scale reflectance to 0–1
    comp = daily.median().divide(10000)

    # ─ True-color RGB visualization
    vis_img = comp.visualize(**vis_params)
    base_id = ee.data.getMapId({'image': vis_img})

    tile = {
        'index':   i,
        'date':    date_str,
        'tileUrl': base_id['tile_fetcher'].url_format
    }

    # ─ Fire overlay for Dec 2–6, 2010 (if bands exist)
    if '2010-12-02' <= date_str <= '2010-12-06':
        try:
            bands = comp.bandNames().getInfo()
            if 'sur_refl_b02' in bands and 'sur_refl_b07' in bands:
                nbr      = comp.normalizedDifference(['sur_refl_b02', 'sur_refl_b07'])
                fire_vis = nbr.lt(0.1).selfMask().visualize(palette=['red'])
                fire_id  = ee.data.getMapId({'image': fire_vis})
                tile['fireUrl'] = fire_id['tile_fetcher'].url_format
            else:
                print(f"{date_str}: missing sur_refl_b02/sur_refl_b07, skipping fire overlay.")
        except Exception as e:
            print(f"{date_str}: error computing fire overlay:", e)

    tiles.append(tile)

# ── Write out for testing ──────────────────────────────────────────────────────
with open('./data/eaton-fire_tiles.json', 'w') as f:
    json.dump(tiles, f, indent=2)

print(f"Saved {len(tiles)} daily MODIS tiles (true-color + fire) to data/eaton-fire_tiles.json")
