from app.f1_client import extract_telemetry
from app.transform import normalize_coordinates
from app.datastore import load_to_redis

def run_pipeline(year: int, round_num: int, race_id: str):
    raw_data = extract_telemetry(year, round_num)
    clean_data = normalize_coordinates(raw_data)
    load_to_redis(race_id, clean_data)

if __name__ == "__main__":
    run_pipeline(2023, 1, "2023_bahrain")