from app.f1_client import load_session, flatten_pos_data
from app.transform import (
    get_normalization_params, normalize_coordinates,
    extract_circuit_path, get_race_start_ms, get_total_laps,
)
from app.events import extract_events, compute_position_snapshots
from app.datastore import store_meta, store_events, store_position_snapshots, load_to_redis


def run_pipeline(year: int, round_num: int, race_id: str):
    print(f"[pipeline] Loading session {year} round {round_num}...")
    session = load_session(year, round_num)

    print("[pipeline] Flattening position data...")
    pos_df = flatten_pos_data(session)

    print("[pipeline] Computing normalization params...")
    params = get_normalization_params(pos_df)

    print("[pipeline] Extracting circuit path...")
    circuit_path = extract_circuit_path(session, params)

    race_start_ms = get_race_start_ms(session)
    total_laps = get_total_laps(session)
    print(f"[pipeline] Race start: {race_start_ms}ms | Total laps: {total_laps}")

    print("[pipeline] Storing meta...")
    store_meta(race_id, {
        'race_start_ms': race_start_ms,
        'total_laps': total_laps,
        'circuit_path': circuit_path,
    })

    print("[pipeline] Normalizing coordinates...")
    clean_df = normalize_coordinates(pos_df, params)

    print("[pipeline] Loading frames to Redis...")
    load_to_redis(race_id, clean_df)

    print("[pipeline] Extracting events...")
    events = extract_events(session)
    store_events(race_id, events)

    print("[pipeline] Computing race position snapshots (may take ~30s)...")
    snapshots = compute_position_snapshots(session)
    store_position_snapshots(race_id, snapshots)

    print("[pipeline] ✅ Done!")


if __name__ == "__main__":
    import os
    year      = int(os.getenv("RACE_YEAR", "2023"))
    round_num = int(os.getenv("RACE_ROUND", "1"))
    race_id   = os.getenv("RACE_ID", f"{year}_r{round_num}")
    run_pipeline(year, round_num, race_id)