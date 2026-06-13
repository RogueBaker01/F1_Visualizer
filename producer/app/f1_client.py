import fastf1
import pandas as pd
import os

CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

def extract_telemetry(year: int, round_number: int) -> pd.DataFrame:
    session = fastf1.get_session(year, round_number, 'R')
    session.load(telemetry=True, laps=True, weather=True)
    frames = []
    for driver_id, df in session.pos_data.items():
        df = df.copy()
        df['Driver'] = driver_id
        frames.append(df)

    return pd.concat(frames, ignore_index=True)
