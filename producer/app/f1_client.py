import fastf1
import pandas as pd
import os

CACHE_DIR = os.getenv("CACHE_DIR", "./cache")
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)


def load_session(year: int, round_number: int):
    """Loads and returns the full FastF1 session object."""
    session = fastf1.get_session(year, round_number, 'R')
    session.load(telemetry=True, laps=True, weather=True)
    return session


def flatten_pos_data(session) -> pd.DataFrame:
    """
    Concatenates session.pos_data (dict {driver_num: DataFrame})
    into a single flat DataFrame with a 'Driver' column.
    """
    frames = []
    for driver_id, df in session.pos_data.items():
        d = df.copy()
        d['Driver'] = str(driver_id)
        frames.append(d)
    return pd.concat(frames, ignore_index=True)
