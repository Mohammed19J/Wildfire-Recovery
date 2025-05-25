#!/usr/bin/env python3
"""
Enhanced Wildfire Data Collection for Realistic Simulation
Collects comprehensive data for before/during/after wildfire analysis

Requirements:
  pip install earthengine-api pandas geopandas requests shapely rasterio xarray netcdf4 pyproj matplotlib

Environment Variables:
  FIRMS_MAP_KEY="your_firms_api_key"
  OPENWEATHER_API_KEY="your_openweather_api_key"
  
Usage:
  python enhanced_wildfire_data_collection.py
"""

import os
import json
import requests
import ee
import pandas as pd
import geopandas as gpd
import numpy as np
import xarray as xr
from shapely.geometry import Point, Polygon
from datetime import datetime, timedelta
import time
from pathlib import Path

# Initialize Earth Engine
def initialize_earth_engine():
    """Initialize Earth Engine with service account or user authentication"""
    try:
        service_account = 'earthengine-access@gen-lang-client-0853931727.iam.gserviceaccount.com'
        key_file = './credentials.json'
        if os.path.exists(key_file):
            credentials = ee.ServiceAccountCredentials(service_account, key_file)
            ee.Initialize(credentials)
        else:
            ee.Authenticate()
            ee.Initialize()
        print("✓ Earth Engine initialized successfully")
    except Exception as e:
        print(f"✗ Earth Engine initialization failed: {e}")
        raise

# Enhanced fire definitions with extended temporal coverage
FIRES = [
    {
        "name": "Creek_Fire_2020",
        "bbox": [-119.65, 36.85, -118.95, 37.70],
        "center": [-119.30, 37.28],
        "start_date": "2020-09-04",
        "end_date": "2020-12-24",
        "pre_fire_start": "2020-06-01",  # 3 months before
        "post_fire_end": "2021-06-01",   # 6 months after
        "state": "CA",
        "acres": 379895
    },
    {
        "name": "Camp_Fire_2018",
        "bbox": [-121.95, 39.25, -121.00, 39.95],
        "center": [-121.48, 39.60],
        "start_date": "2018-11-08",
        "end_date": "2018-11-25",
        "pre_fire_start": "2018-08-01",
        "post_fire_end": "2019-05-01",
        "state": "CA",
        "acres": 153336
    },
    {
        "name": "Dixie_Fire_2021",
        "bbox": [-122.10, 39.40, -120.90, 40.10],
        "center": [-121.50, 39.75],
        "start_date": "2021-07-13",
        "end_date": "2021-10-25",
        "pre_fire_start": "2021-04-01",
        "post_fire_end": "2022-04-01",
        "state": "CA",
        "acres": 963309
    },
    {
        "name": "Marshall_Fire_2021",
        "bbox": [-105.30, 39.90, -105.15, 40.05],
        "center": [-105.23, 39.98],
        "start_date": "2021-12-30",
        "end_date": "2022-01-02",
        "pre_fire_start": "2021-09-01",
        "post_fire_end": "2022-07-01",
        "state": "CO",
        "acres": 6026
    },
    {
        "name": "Bootleg_Fire_2021",
        "bbox": [-121.70, 42.00, -121.00, 42.70],
        "center": [-121.35, 42.35],
        "start_date": "2021-07-06",
        "end_date": "2021-08-15",
        "pre_fire_start": "2021-04-01",
        "post_fire_end": "2022-01-01",
        "state": "OR",
        "acres": 413717
    }
]

class WildfireDataCollector:
    def __init__(self, fire_config, base_dir="wildfire_data"):
        self.fire = fire_config
        self.base_dir = Path(base_dir)
        self.fire_dir = self.base_dir / fire_config['name']
        self.fire_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        for subdir in ['satellite', 'weather', 'topography', 'fire_detection', 'fuel_models', 'metadata']:
            (self.fire_dir / subdir).mkdir(exist_ok=True)
            
        print(f"📁 Initialized data collection for {self.fire['name']}")

    def collect_high_resolution_imagery(self):
        """Collect high-resolution satellite imagery for before/during/after periods"""
        print(f"🛰️  Collecting high-resolution imagery for {self.fire['name']}...")
        
        region = ee.Geometry.Rectangle(self.fire['bbox'])
        
        # Define time periods
        periods = {
            'pre_fire': (self.fire['pre_fire_start'], self.fire['start_date']),
            'during_fire': (self.fire['start_date'], self.fire['end_date']),
            'post_fire': (self.fire['end_date'], self.fire['post_fire_end'])
        }
        
        for period_name, (start_date, end_date) in periods.items():
            print(f"  Processing {period_name} period: {start_date} to {end_date}")
            
            # Sentinel-2 (10m resolution)
            self._collect_sentinel2(region, start_date, end_date, period_name)
            
            # Landsat 8/9 (30m resolution)
            self._collect_landsat(region, start_date, end_date, period_name)
            
            # MODIS for daily coverage
            self._collect_modis_daily(region, start_date, end_date, period_name)

    def _collect_sentinel2(self, region, start_date, end_date, period):
        """Collect Sentinel-2 imagery"""
        try:
            s2_collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                           .filterBounds(region)
                           .filterDate(start_date, end_date)
                           .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                           .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12']))  # RGB, NIR, SWIR
            
            count = s2_collection.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No Sentinel-2 images for {period}")
                return
                
            # Create composite image
            composite = s2_collection.median()
            
            # Calculate indices
            ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI')
            nbr = composite.normalizedDifference(['B8', 'B12']).rename('NBR')  # Normalized Burn Ratio
            ndwi = composite.normalizedDifference(['B3', 'B8']).rename('NDWI')  # Water index
            
            # Combine all bands
            final_image = composite.addBands([ndvi, nbr, ndwi])
            
            # Export configuration
            export_config = {
                'image': final_image,
                'region': region,
                'scale': 10,
                'maxPixels': 1e13,
                'fileFormat': 'GeoTIFF'
            }
            
            # Save metadata
            metadata = {
                'satellite': 'Sentinel-2',
                'period': period,
                'date_range': f"{start_date} to {end_date}",
                'image_count': count,
                'resolution': '10m',
                'bands': ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'NBR', 'NDWI']
            }
            
            with open(self.fire_dir / 'satellite' / f'sentinel2_{period}_metadata.json', 'w') as f:
                json.dump(metadata, f, indent=2)
                
            print(f"    ✓ Processed {count} Sentinel-2 images for {period}")
            
        except Exception as e:
            print(f"    ✗ Error collecting Sentinel-2 for {period}: {e}")

    def _collect_landsat(self, region, start_date, end_date, period):
        """Collect Landsat 8/9 imagery"""
        try:
            # Landsat 8 Collection 2 Tier 1
            l8_collection = (ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                           .filterBounds(region)
                           .filterDate(start_date, end_date)
                           .filter(ee.Filter.lt('CLOUD_COVER', 20)))
            
            # Landsat 9 Collection 2 Tier 1
            l9_collection = (ee.ImageCollection('LANDSAT/LC09/C02/T1_L2')
                           .filterBounds(region)
                           .filterDate(start_date, end_date)
                           .filter(ee.Filter.lt('CLOUD_COVER', 20)))
            
            # Merge collections
            landsat_collection = l8_collection.merge(l9_collection)
            
            count = landsat_collection.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No Landsat images for {period}")
                return
            
            # Scale and mask clouds
            def scale_landsat(image):
                optical_bands = image.select('SR_B.').multiply(0.0000275).add(-0.2)
                thermal_bands = image.select('ST_B.*').multiply(0.00341802).add(149.0)
                return image.addBands(optical_bands, None, True).addBands(thermal_bands, None, True)
            
            landsat_collection = landsat_collection.map(scale_landsat)
            
            # Create composite
            composite = landsat_collection.median()
            
            # Calculate fire-relevant indices
            ndvi = composite.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI')
            nbr = composite.normalizedDifference(['SR_B5', 'SR_B7']).rename('NBR')
            bai = composite.expression(
                '1.0 / ((0.1 - RED)**2 + (0.06 - NIR)**2)',
                {'RED': composite.select('SR_B4'), 'NIR': composite.select('SR_B5')}
            ).rename('BAI')  # Burn Area Index
            
            final_image = composite.addBands([ndvi, nbr, bai])
            
            metadata = {
                'satellite': 'Landsat 8/9',
                'period': period,
                'date_range': f"{start_date} to {end_date}",
                'image_count': count,
                'resolution': '30m',
                'bands': ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10', 'NDVI', 'NBR', 'BAI']
            }
            
            with open(self.fire_dir / 'satellite' / f'landsat_{period}_metadata.json', 'w') as f:
                json.dump(metadata, f, indent=2)
                
            print(f"    ✓ Processed {count} Landsat images for {period}")
            
        except Exception as e:
            print(f"    ✗ Error collecting Landsat for {period}: {e}")

    def _collect_modis_daily(self, region, start_date, end_date, period):
        """Collect daily MODIS data for fire monitoring"""
        try:
            # MODIS Terra Daily Surface Reflectance
            modis_collection = (ee.ImageCollection('MODIS/061/MOD09GA')
                              .filterBounds(region)
                              .filterDate(start_date, end_date)
                              .select(['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b06', 'sur_refl_b07']))
            
            count = modis_collection.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No MODIS images for {period}")
                return
            
            # Create time series of fire indices
            def add_fire_indices(image):
                # Scale reflectance values
                scaled = image.multiply(0.0001)
                
                # Calculate NBR (Normalized Burn Ratio)
                nbr = scaled.normalizedDifference(['sur_refl_b02', 'sur_refl_b07']).rename('NBR')
                
                # Calculate NDVI
                ndvi = scaled.normalizedDifference(['sur_refl_b02', 'sur_refl_b01']).rename('NDVI')
                
                return image.addBands([nbr, ndvi]).set('system:time_start', image.get('system:time_start'))
            
            processed_collection = modis_collection.map(add_fire_indices)
            
            # Extract time series data
            time_series = []
            image_list = processed_collection.toList(count)
            
            for i in range(min(count, 100)):  # Limit to avoid timeout
                img = ee.Image(image_list.get(i))
                date = ee.Date(img.get('system:time_start')).format('YYYY-MM-dd')
                
                # Calculate regional statistics
                stats = img.select(['NBR', 'NDVI']).reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=500,
                    maxPixels=1e9
                )
                
                time_series.append({
                    'date': date.getInfo(),
                    'nbr_mean': stats.get('NBR').getInfo(),
                    'ndvi_mean': stats.get('NDVI').getInfo()
                })
            
            # Save time series
            df = pd.DataFrame(time_series)
            df.to_csv(self.fire_dir / 'satellite' / f'modis_timeseries_{period}.csv', index=False)
            
            print(f"    ✓ Processed {count} MODIS images for {period}")
            
        except Exception as e:
            print(f"    ✗ Error collecting MODIS for {period}: {e}")

    def collect_topographic_data(self):
        """Collect comprehensive topographic data"""
        print(f"🏔️  Collecting topographic data for {self.fire['name']}...")
        
        region = ee.Geometry.Rectangle(self.fire['bbox'])
        
        try:
            # NASA SRTM Digital Elevation Model (30m)
            dem = ee.Image('USGS/SRTMGL1_003').clip(region)
            
            # Calculate terrain derivatives
            slope = ee.Terrain.slope(dem).rename('slope')
            aspect = ee.Terrain.aspect(dem).rename('aspect')
            hillshade = ee.Terrain.hillshade(dem).rename('hillshade')
            
            # Calculate additional terrain metrics
            # Topographic Wetness Index
            flow_accumulation = dem.focal_max(1).subtract(dem).rename('flow_accumulation')
            twi = flow_accumulation.divide(slope.add(0.001)).log().rename('twi')
            
            # Terrain Ruggedness Index
            tri = dem.focal_max(1).subtract(dem.focal_min(1)).rename('tri')
            
            # Combine all terrain data
            terrain_data = dem.addBands([slope, aspect, hillshade, twi, tri])
            
            # Calculate terrain statistics
            terrain_stats = terrain_data.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', True),
                geometry=region,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            # Save terrain statistics
            with open(self.fire_dir / 'topography' / 'terrain_statistics.json', 'w') as f:
                json.dump(terrain_stats, f, indent=2)
            
            # Export terrain raster (this would need to be done via Earth Engine Tasks in real implementation)
            print(f"    ✓ Processed terrain data (elevation, slope, aspect, TWI, TRI)")
            
        except Exception as e:
            print(f"    ✗ Error collecting topographic data: {e}")

    def collect_weather_data(self):
        """Collect comprehensive weather data"""
        print(f"🌤️  Collecting weather data for {self.fire['name']}...")
        
        # ERA5 Weather Data from Google Earth Engine
        self._collect_era5_weather()
        
        # NOAA weather station data (if available)
        self._collect_noaa_weather()
        
        # Fire Weather Index calculations
        self._calculate_fire_weather_indices()

    def _collect_era5_weather(self):
        """Collect ERA5 reanalysis weather data"""
        try:
            region = ee.Geometry.Rectangle(self.fire['bbox'])
            
            # ERA5 Daily Aggregates
            era5_collection = (ee.ImageCollection('ECMWF/ERA5/DAILY')
                             .filterBounds(region)
                             .filterDate(self.fire['pre_fire_start'], self.fire['post_fire_end'])
                             .select([
                                 'mean_2m_air_temperature',
                                 'minimum_2m_air_temperature', 
                                 'maximum_2m_air_temperature',
                                 'dewpoint_2m_temperature',
                                 'mean_sea_level_pressure',
                                 'surface_pressure',
                                 'u_component_of_wind_10m',
                                 'v_component_of_wind_10m',
                                 'total_precipitation'
                             ]))
            
            # Convert to time series
            def extract_weather_data(image):
                date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd')
                
                # Calculate additional metrics
                wind_speed = image.expression(
                    'sqrt(u*u + v*v)',
                    {'u': image.select('u_component_of_wind_10m'),
                     'v': image.select('v_component_of_wind_10m')}
                ).rename('wind_speed')
                
                wind_direction = image.expression(
                    'atan2(v, u) * 180 / 3.14159',
                    {'u': image.select('u_component_of_wind_10m'),
                     'v': image.select('v_component_of_wind_10m')}
                ).rename('wind_direction')
                
                # Relative humidity calculation
                temp_k = image.select('mean_2m_air_temperature')
                dewpoint_k = image.select('dewpoint_2m_temperature')
                
                rh = image.expression(
                    '100 * exp((17.625 * (Td - 273.15)) / (243.04 + (Td - 273.15))) / exp((17.625 * (T - 273.15)) / (243.04 + (T - 273.15)))',
                    {'T': temp_k, 'Td': dewpoint_k}
                ).rename('relative_humidity')
                
                enhanced_image = image.addBands([wind_speed, wind_direction, rh])
                
                # Regional statistics
                stats = enhanced_image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=25000,  # ERA5 native resolution ~25km
                    maxPixels=1e6
                )
                
                return ee.Feature(None, stats.set('date', date))
            
            weather_features = era5_collection.map(extract_weather_data)
            weather_data = weather_features.getInfo()
            
            # Convert to DataFrame
            weather_records = []
            for feature in weather_data['features']:
                props = feature['properties']
                weather_records.append(props)
            
            weather_df = pd.DataFrame(weather_records)
            weather_df['date'] = pd.to_datetime(weather_df['date'])
            weather_df = weather_df.sort_values('date')
            
            # Convert temperature from Kelvin to Celsius
            temp_cols = [col for col in weather_df.columns if 'temperature' in col]
            for col in temp_cols:
                weather_df[col] = weather_df[col] - 273.15
            
            # Save weather data
            weather_df.to_csv(self.fire_dir / 'weather' / 'era5_weather_data.csv', index=False)
            
            print(f"    ✓ Collected {len(weather_df)} days of ERA5 weather data")
            
        except Exception as e:
            print(f"    ✗ Error collecting ERA5 weather data: {e}")

    def _collect_noaa_weather(self):
        """Collect NOAA weather station data (placeholder - would need NOAA API implementation)"""
        print(f"    ⚠️  NOAA weather station data collection not yet implemented")
        # This would require NOAA API integration with station finding based on fire location

    def _calculate_fire_weather_indices(self):
        """Calculate fire weather indices from collected weather data"""
        try:
            weather_file = self.fire_dir / 'weather' / 'era5_weather_data.csv'
            if not weather_file.exists():
                return
                
            df = pd.read_csv(weather_file)
            df['date'] = pd.to_datetime(df['date'])
            
            # Fire Weather Index components
            # Fine Fuel Moisture Code (FFMC)
            def calculate_ffmc(temp, rh, wind, rain, prev_ffmc=85):
                # Simplified FFMC calculation
                mo = 147.2 * (101 - prev_ffmc) / (59.5 + prev_ffmc)
                if rain > 0.5:
                    mo = mo + 42.5 * rain * np.exp(-100 / (251 - mo)) * (1 - np.exp(-6.93 / rain))
                
                ed = 0.942 * (rh**0.679) + 11 * np.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - np.exp(-0.115 * rh))
                ew = 0.618 * (rh**0.753) + 10 * np.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - np.exp(-0.115 * rh))
                
                if mo > ed:
                    ko = 0.424 * (1 - ((100 - rh) / 100)**1.7) + 0.0694 * wind**0.5 * (1 - ((100 - rh) / 100)**8)
                    kd = ko * 0.581 * np.exp(0.0365 * temp)
                    mo = ed + (mo - ed) * 10**(-kd)
                else:
                    ko = 0.424 * (1 - (rh / 100)**1.7) + 0.0694 * wind**0.5 * (1 - (rh / 100)**8)
                    kw = ko * 0.581 * np.exp(0.0365 * temp)
                    mo = ew - (ew - mo) * 10**(-kw)
                
                ffmc = 59.5 * (250 - mo) / (147.2 + mo)
                return max(0, min(101, ffmc))
            
            # Calculate daily fire weather indices
            df['ffmc'] = 85  # Initialize
            df['duff_moisture'] = 6  # Initial Duff Moisture Code
            df['drought_code'] = 15  # Initial Drought Code
            
            for i in range(1, len(df)):
                prev_ffmc = df.loc[i-1, 'ffmc']
                df.loc[i, 'ffmc'] = calculate_ffmc(
                    df.loc[i, 'maximum_2m_air_temperature'],
                    df.loc[i, 'relative_humidity'],
                    df.loc[i, 'wind_speed'],
                    df.loc[i, 'total_precipitation'] * 1000,  # Convert m to mm
                    prev_ffmc
                )
            
            # Fire Weather Index (simplified)
            df['fire_weather_index'] = 1.25 * df['ffmc'] * np.exp(0.05 * df['wind_speed'])
            
            # Save enhanced weather data with fire indices
            df.to_csv(self.fire_dir / 'weather' / 'fire_weather_indices.csv', index=False)
            
            print(f"    ✓ Calculated fire weather indices (FFMC, FWI)")
            
        except Exception as e:
            print(f"    ✗ Error calculating fire weather indices: {e}")

    def collect_fire_detection_data(self):
        """Collect comprehensive fire detection data"""
        print(f"🔥 Collecting fire detection data for {self.fire['name']}...")
        
        # FIRMS active fire data
        self._collect_firms_data()
        
        # MODIS/VIIRS fire products
        self._collect_modis_fire_products()
        
        # Burned area products
        self._collect_burned_area_products()

    def _collect_firms_data(self):
        """Enhanced FIRMS data collection"""
        key = os.getenv('FIRMS_MAP_KEY')
        if not key:
            print("    ⚠️  FIRMS_MAP_KEY not set, skipping FIRMS data")
            return
        
        west, south, east, north = self.fire['bbox']
        
        # Collect data for extended period
        for product in ['MODIS_NRT', 'VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT']:
            try:
                url = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
                params = {
                    'map_key': key,
                    'product': product,
                    'date_min': self.fire['pre_fire_start'],
                    'date_max': self.fire['post_fire_end'],
                    'bbox': f"{west},{south},{east},{north}"
                }
                
                response = requests.get(url, params=params, timeout=30)
                response.raise_for_status()
                
                csv_path = self.fire_dir / 'fire_detection' / f'firms_{product}.csv'
                csv_path.write_text(response.text)
                
                # Process and enhance the data
                if response.text.strip() and not response.text.startswith('<!DOCTYPE'):
                    df = pd.read_csv(csv_path)
                    if len(df) > 0 and 'latitude' in df.columns:
                        # Add temporal categorization
                        df['acq_date'] = pd.to_datetime(df['acq_date'])
                        df['fire_period'] = 'unknown'
                        
                        fire_start = pd.to_datetime(self.fire['start_date'])
                        fire_end = pd.to_datetime(self.fire['end_date'])
                        
                        df.loc[df['acq_date'] < fire_start, 'fire_period'] = 'pre_fire'
                        df.loc[(df['acq_date'] >= fire_start) & (df['acq_date'] <= fire_end), 'fire_period'] = 'during_fire'
                        df.loc[df['acq_date'] > fire_end, 'fire_period'] = 'post_fire'
                        
                        # Create GeoDataFrame
                        gdf = gpd.GeoDataFrame(
                            df,
                            geometry=[Point(xy) for xy in zip(df.longitude, df.latitude)],
                            crs="EPSG:4326"
                        )
                        
                        geojson_path = self.fire_dir / 'fire_detection' / f'firms_{product}.geojson'
                        gdf.to_file(geojson_path, driver='GeoJSON')
                        
                        print(f"    ✓ Collected {len(df)} FIRMS {product} detections")
                    else:
                        print(f"    ⚠️  No valid FIRMS {product} data")
                else:
                    print(f"    ⚠️  Empty or invalid FIRMS {product} response")
                    
            except Exception as e:
                print(f"    ✗ Error collecting FIRMS {product}: {e}")

    def _collect_modis_fire_products(self):
        """Collect MODIS fire products"""
        try:
            region = ee.Geometry.Rectangle(self.fire['bbox'])
            
            # MODIS Thermal Anomalies and Fire Daily Global 1km
            modis_fire = (ee.ImageCollection('MODIS/061/MOD14A1')
                         .filterBounds(region)
                         .filterDate(self.fire['pre_fire_start'], self.fire['post_fire_end'])
                         .select(['FireMask', 'QA']))
            
            count = modis_fire.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No MODIS fire products available")
                return
            
            # Create fire mask composite
            fire_composite = modis_fire.select('FireMask').max()
            
            # Export fire detections as vectors
            fire_pixels = fire_composite.gt(7)  # Fire pixels (confidence > 7)
            fire_vectors = fire_pixels.reduceToVectors(
                geometry=region,
                scale=1000,
                maxPixels=1e10
            )
            
            fire_data = fire_vectors.getInfo()
            
            with open(self.fire_dir / 'fire_detection' / 'modis_fire_detections.geojson', 'w') as f:
                json.dump(fire_data, f, indent=2)
            
            print(f"    ✓ Processed {count} MODIS fire detection images")
            
        except Exception as e:
            print(f"    ✗ Error collecting MODIS fire products: {e}")

    def _collect_burned_area_products(self):
        """Collect burned area products with temporal analysis"""
        try:
            region = ee.Geometry.Rectangle(self.fire['bbox'])
            
            # MODIS Burned Area Monthly Global 500m
            burned_area = (ee.ImageCollection('MODIS/061/MCD64A1')
                          .filterBounds(region)
                          .filterDate(self.fire['pre_fire_start'], self.fire['post_fire_end'])
                          .select(['BurnDate', 'Uncertainty', 'QA']))
            
            count = burned_area.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No burned area products available")
                return
            
            # Create burned area mask
            burn_mask = burned_area.select('BurnDate').max().gt(0)
            
            # Convert to vectors for analysis
            burn_vectors = burn_mask.reduceToVectors(
                geometry=region,
                scale=500,
                maxPixels=1e10,
                geometryType='polygon'
            )
            
            burn_data = burn_vectors.getInfo()
            
            # Calculate burned area statistics
            total_area = 0
            if burn_data and 'features' in burn_data:
                for feature in burn_data['features']:
                    if 'geometry' in feature and feature['geometry']['type'] == 'Polygon':
                        coords = feature['geometry']['coordinates'][0]
                        polygon = Polygon(coords)
                        total_area += polygon.area * 111000 * 111000  # Rough conversion to m²
            
            # Save burned area data
            with open(self.fire_dir / 'fire_detection' / 'burned_area.geojson', 'w') as f:
                json.dump(burn_data, f, indent=2)
            
            # Save burned area statistics
            burn_stats = {
                'total_burned_area_hectares': total_area / 10000,
                'total_burned_area_acres': total_area / 4047,
                'official_fire_size_acres': self.fire.get('acres', 0),
                'detection_accuracy': min(1.0, (total_area / 4047) / self.fire.get('acres', 1)) if self.fire.get('acres') else 0
            }
            
            with open(self.fire_dir / 'fire_detection' / 'burned_area_stats.json', 'w') as f:
                json.dump(burn_stats, f, indent=2)
            
            print(f"    ✓ Processed burned area: {burn_stats['total_burned_area_acres']:.0f} acres")
            
        except Exception as e:
            print(f"    ✗ Error collecting burned area products: {e}")

    def collect_fuel_data(self):
        """Collect fuel load and vegetation data"""
        print(f"🌲 Collecting fuel and vegetation data for {self.fire['name']}...")
        
        region = ee.Geometry.Rectangle(self.fire['bbox'])
        
        try:
            # LANDFIRE Fuel Models
            self._collect_landfire_data(region)
            
            # Vegetation indices time series
            self._collect_vegetation_indices(region)
            
            # Forest canopy data
            self._collect_forest_canopy_data(region)
            
        except Exception as e:
            print(f"    ✗ Error collecting fuel data: {e}")

    def _collect_landfire_data(self, region):
        """Collect LANDFIRE fuel model data"""
        try:
            # LANDFIRE Surface Fuel Models
            fuel_models = ee.Image('LANDFIRE/Fire/FBFM40/v1').clip(region)
            
            # LANDFIRE Canopy Cover
            canopy_cover = ee.Image('LANDFIRE/Fire/CC/v1').clip(region)
            
            # LANDFIRE Canopy Height
            canopy_height = ee.Image('LANDFIRE/Fire/CH/v1').clip(region)
            
            # LANDFIRE Canopy Base Height
            canopy_base = ee.Image('LANDFIRE/Fire/CBH/v1').clip(region)
            
            # LANDFIRE Canopy Bulk Density
            canopy_density = ee.Image('LANDFIRE/Fire/CBD/v1').clip(region)
            
            # Combine all fuel data
            fuel_composite = fuel_models.addBands([canopy_cover, canopy_height, canopy_base, canopy_density])
            
            # Calculate fuel statistics by region
            fuel_stats = fuel_composite.reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', True)
                         .combine(ee.Reducer.minMax(), '', True),
                geometry=region,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            # Create fuel model histogram
            fuel_histogram = fuel_models.reduceRegion(
                reducer=ee.Reducer.frequencyHistogram(),
                geometry=region,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            # Save fuel data
            fuel_data = {
                'statistics': fuel_stats,
                'fuel_model_distribution': fuel_histogram,
                'data_sources': [
                    'LANDFIRE Surface Fuel Models (FBFM40)',
                    'LANDFIRE Canopy Cover',
                    'LANDFIRE Canopy Height', 
                    'LANDFIRE Canopy Base Height',
                    'LANDFIRE Canopy Bulk Density'
                ]
            }
            
            with open(self.fire_dir / 'fuel_models' / 'landfire_fuel_data.json', 'w') as f:
                json.dump(fuel_data, f, indent=2)
            
            print(f"    ✓ Collected LANDFIRE fuel model data")
            
        except Exception as e:
            print(f"    ✗ Error collecting LANDFIRE data: {e}")

    def _collect_vegetation_indices(self, region):
        """Collect vegetation indices time series"""
        try:
            # MODIS Vegetation Indices (MOD13A1)
            modis_vi = (ee.ImageCollection('MODIS/061/MOD13A1')
                       .filterBounds(region)
                       .filterDate(self.fire['pre_fire_start'], self.fire['post_fire_end'])
                       .select(['NDVI', 'EVI']))
            
            count = modis_vi.size().getInfo()
            if count == 0:
                print(f"    ⚠️  No vegetation index data available")
                return
            
            # Extract time series
            def extract_vi_data(image):
                date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd')
                stats = image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=region,
                    scale=500,
                    maxPixels=1e8
                )
                return ee.Feature(None, stats.set('date', date))
            
            vi_features = modis_vi.map(extract_vi_data)
            vi_data = vi_features.getInfo()
            
            # Convert to DataFrame
            vi_records = []
            for feature in vi_data['features']:
                props = feature['properties']
                vi_records.append(props)
            
            vi_df = pd.DataFrame(vi_records)
            vi_df['date'] = pd.to_datetime(vi_df['date'])
            vi_df = vi_df.sort_values('date')
            
            # Scale MODIS VI values
            vi_df['NDVI'] = vi_df['NDVI'] * 0.0001
            vi_df['EVI'] = vi_df['EVI'] * 0.0001
            
            # Add fire period labels
            fire_start = pd.to_datetime(self.fire['start_date'])
            fire_end = pd.to_datetime(self.fire['end_date'])
            
            vi_df['fire_period'] = 'unknown'
            vi_df.loc[vi_df['date'] < fire_start, 'fire_period'] = 'pre_fire'
            vi_df.loc[(vi_df['date'] >= fire_start) & (vi_df['date'] <= fire_end), 'fire_period'] = 'during_fire'
            vi_df.loc[vi_df['date'] > fire_end, 'fire_period'] = 'post_fire'
            
            # Save vegetation index time series
            vi_df.to_csv(self.fire_dir / 'fuel_models' / 'vegetation_indices_timeseries.csv', index=False)
            
            print(f"    ✓ Collected {len(vi_df)} vegetation index measurements")
            
        except Exception as e:
            print(f"    ✗ Error collecting vegetation indices: {e}")

    def _collect_forest_canopy_data(self, region):
        """Collect detailed forest structure data"""
        try:
            # Global Forest Change (Hansen et al.)
            forest_change = ee.Image('UMD/hansen/global_forest_change_2023_v1_11').clip(region)
            
            # Tree cover percentage in 2000
            tree_cover_2000 = forest_change.select('treecover2000')
            
            # Forest loss year
            forest_loss = forest_change.select('lossyear')
            
            # Forest gain 2000-2020
            forest_gain = forest_change.select('gain')
            
            # Calculate forest statistics
            forest_stats = forest_change.select(['treecover2000', 'lossyear', 'gain']).reduceRegion(
                reducer=ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', True),
                geometry=region,
                scale=30,
                maxPixels=1e9
            ).getInfo()
            
            # Calculate area of forest loss by year
            loss_by_year = {}
            for year in range(1, 24):  # 2001-2023
                year_mask = forest_loss.eq(year)
                area = year_mask.multiply(ee.Image.pixelArea()).reduceRegion(
                    reducer=ee.Reducer.sum(),
                    geometry=region,
                    scale=30,
                    maxPixels=1e9
                ).get('lossyear')
                loss_by_year[2000 + year] = area.getInfo() if area else 0
            
            # Save forest data
            forest_data = {
                'forest_statistics': forest_stats,
                'forest_loss_by_year_hectares': {year: area/10000 for year, area in loss_by_year.items()},
                'fire_year_forest_loss_hectares': loss_by_year.get(int(self.fire['start_date'][:4]), 0) / 10000
            }
            
            with open(self.fire_dir / 'fuel_models' / 'forest_structure_data.json', 'w') as f:
                json.dump(forest_data, f, indent=2)
            
            print(f"    ✓ Collected forest structure data")
            
        except Exception as e:
            print(f"    ✗ Error collecting forest canopy data: {e}")

    def generate_simulation_config(self):
        """Generate configuration file for wildfire simulation"""
        print(f"⚙️  Generating simulation configuration for {self.fire['name']}...")
        
        try:
            # Load collected data for analysis
            config = {
                'fire_metadata': {
                    'name': self.fire['name'],
                    'location': {
                        'bbox': self.fire['bbox'],
                        'center': self.fire['center'],
                        'state': self.fire['state']
                    },
                    'temporal_extent': {
                        'ignition_date': self.fire['start_date'],
                        'containment_date': self.fire['end_date'],
                        'pre_fire_monitoring_start': self.fire['pre_fire_start'],
                        'post_fire_monitoring_end': self.fire['post_fire_end']
                    },
                    'official_size_acres': self.fire.get('acres', 0)
                },
                'simulation_parameters': {
                    'grid_resolution_meters': 30,
                    'time_step_hours': 1,
                    'simulation_duration_hours': self._calculate_fire_duration_hours(),
                    'ignition_points': self._estimate_ignition_points(),
                    'weather_update_frequency_hours': 3
                },
                'data_sources': {
                    'satellite_imagery': [
                        'Sentinel-2 (10m resolution)',
                        'Landsat 8/9 (30m resolution)', 
                        'MODIS (250m-1km resolution)'
                    ],
                    'weather_data': [
                        'ERA5 Reanalysis (25km resolution)',
                        'Fire Weather Index calculations'
                    ],
                    'topography': [
                        'SRTM DEM (30m resolution)',
                        'Terrain derivatives (slope, aspect, TWI, TRI)'
                    ],
                    'fuel_models': [
                        'LANDFIRE Surface Fuel Models',
                        'LANDFIRE Canopy Characteristics',
                        'MODIS Vegetation Indices'
                    ],
                    'fire_detection': [
                        'NASA FIRMS Active Fire Data',
                        'MODIS Fire Products',
                        'Burned Area Mapping'
                    ]
                },
                'validation_metrics': {
                    'spatial_accuracy': 'Burned area comparison',
                    'temporal_accuracy': 'Fire progression timing',
                    'fire_behavior': 'Rate of spread validation'
                }
            }
            
            # Save simulation configuration
            with open(self.fire_dir / 'simulation_config.json', 'w') as f:
                json.dump(config, f, indent=2)
            
            print(f"    ✓ Generated simulation configuration")
            
            return config
            
        except Exception as e:
            print(f"    ✗ Error generating simulation config: {e}")
            return None

    def _calculate_fire_duration_hours(self):
        """Calculate fire duration in hours"""
        start = datetime.strptime(self.fire['start_date'], '%Y-%m-%d')
        end = datetime.strptime(self.fire['end_date'], '%Y-%m-%d')
        return int((end - start).total_seconds() / 3600)

    def _estimate_ignition_points(self):
        """Estimate ignition points from early fire detections"""
        # This would analyze early FIRMS detections to estimate ignition locations
        return [self.fire['center']]  # Simplified

    def create_summary_report(self):
        """Create a comprehensive data collection summary"""
        print(f"📊 Creating summary report for {self.fire['name']}...")
        
        report = {
            'fire_name': self.fire['name'],
            'collection_date': datetime.now().isoformat(),
            'data_directory': str(self.fire_dir),
            'collected_datasets': []
        }
        
        # Check what data was collected
        data_categories = {
            'satellite': 'High-resolution satellite imagery',
            'weather': 'Meteorological data and fire weather indices',
            'topography': 'Digital elevation model and terrain derivatives', 
            'fire_detection': 'Active fire detections and burned area mapping',
            'fuel_models': 'Fuel load and vegetation characteristics'
        }
        
        for category, description in data_categories.items():
            category_dir = self.fire_dir / category
            if category_dir.exists():
                files = list(category_dir.glob('*'))
                if files:
                    report['collected_datasets'].append({
                        'category': category,
                        'description': description,
                        'file_count': len(files),
                        'files': [f.name for f in files]
                    })
        
        # Save summary report
        with open(self.fire_dir / 'data_collection_summary.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"    ✓ Summary report saved")
        
        # Print collection summary
        print(f"\n📋 Data Collection Summary for {self.fire['name']}:")
        print(f"   📁 Output directory: {self.fire_dir}")
        print(f"   📅 Fire period: {self.fire['start_date']} to {self.fire['end_date']}")
        print(f"   🔥 Official size: {self.fire.get('acres', 'Unknown')} acres")
        print(f"   📊 Datasets collected: {len(report['collected_datasets'])}")
        
        for dataset in report['collected_datasets']:
            print(f"      • {dataset['description']}: {dataset['file_count']} files")

def main():
    """Main execution function"""
    print("🚀 Starting Enhanced Wildfire Data Collection")
    print("=" * 60)
    
    # Initialize Earth Engine
    initialize_earth_engine()
    
    # Process each fire
    for fire_config in FIRES:
        print(f"\n🔥 Processing {fire_config['name']}")
        print("-" * 40)
        
        try:
            # Initialize collector
            collector = WildfireDataCollector(fire_config)
            
            # Collect all data types
            collector.collect_high_resolution_imagery()
            collector.collect_topographic_data()
            collector.collect_weather_data()
            collector.collect_fire_detection_data()
            collector.collect_fuel_data()
            
            # Generate simulation configuration
            collector.generate_simulation_config()
            
            # Create summary report
            collector.create_summary_report()
            
            print(f"✅ Completed data collection for {fire_config['name']}")
            
        except Exception as e:
            print(f"❌ Failed to process {fire_config['name']}: {e}")
            continue
    
    print("\n🎉 Enhanced Wildfire Data Collection Complete!")
    print("=" * 60)
    print("\n📁 Data Structure:")
    print("wildfire_data/")
    print("├── {Fire_Name}/")
    print("│   ├── satellite/           # High-resolution imagery & indices")
    print("│   ├── weather/             # Meteorological data & fire weather")
    print("│   ├── topography/          # DEM & terrain derivatives")
    print("│   ├── fire_detection/      # Active fires & burned areas")
    print("│   ├── fuel_models/         # Vegetation & fuel characteristics")
    print("│   ├── metadata/            # Processing metadata")
    print("│   ├── simulation_config.json")
    print("│   └── data_collection_summary.json")
    print("\n🎯 This data can now be used for:")
    print("   • Realistic wildfire spread modeling")
    print("   • Before/during/after fire analysis")
    print("   • Fire behavior validation")
    print("   • Risk assessment and prediction")

if __name__ == '__main__':
    main()