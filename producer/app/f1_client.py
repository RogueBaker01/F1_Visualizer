import fastf1
import os

CACHE_DIR= os.getenv("CACHE_DIR", "./cache")
os.makedirs(CACHE_DIR,exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

def extract_telemetry(year:int, round_number:int):
    session = fastf1.get_session(year,round_number,'R')
    session.load(telemetry=True, laps=True, weather=True)
    return session.pos_data
    