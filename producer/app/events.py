import pandas as pd
import json


def _build_abbr_map(session) -> dict[str, str]:
    """Returns {driver_number_str: abbreviation} from the session's own driver list.
    Works for any season FastF1 supports. Falls back to driver number if lookup fails.
    """
    abbr_map: dict[str, str] = {}
    try:
        for d_num in session.drivers:
            key = str(int(float(d_num)))
            try:
                info = session.get_driver(d_num)
                abbr_map[key] = info.get("Abbreviation", key)
            except Exception:
                abbr_map[key] = key
    except Exception:
        pass
    return abbr_map


def _driver_abbr(abbr_map: dict[str, str], driver_num) -> str:
    key = str(int(float(driver_num)))
    return abbr_map.get(key, key)


def extract_events(session) -> list[dict]:
    """Extracts pit stops, DNFs and safety car events from session data."""
    events = []
    laps = session.laps.copy()
    abbr_map = _build_abbr_map(session)

    # ── Pit in / out ─────────────────────────────────────────────────────────
    for _, lap in laps.iterrows():
        try:
            driver_num = lap['DriverNumber']
            if pd.isna(driver_num):
                continue
            abbr = _driver_abbr(abbr_map, driver_num)
            lap_num = int(lap['LapNumber']) if pd.notna(lap['LapNumber']) else None

            if pd.notna(lap.get('PitInTime')):
                t_ms = int(lap['PitInTime'].total_seconds() * 1000)
                events.append({
                    'time_ms': t_ms, 'type': 'pit_in',
                    'driver': abbr, 'lap': lap_num,
                    'message': f"PIT IN  {abbr}  Vuelta {lap_num}"
                })

            if pd.notna(lap.get('PitOutTime')):
                t_ms = int(lap['PitOutTime'].total_seconds() * 1000)
                events.append({
                    'time_ms': t_ms, 'type': 'pit_out',
                    'driver': abbr, 'lap': lap_num,
                    'message': f"PIT OUT  {abbr}  Vuelta {lap_num}"
                })
        except Exception:
            continue

    # ── DNF (from results) ────────────────────────────────────────────────────
    try:
        if session.results is not None and len(session.results) > 0:
            for _, result in session.results.iterrows():
                status = str(result.get('Status', ''))
                finished_statuses = {'Finished', '+1 Lap', '+2 Laps', '+3 Laps',
                                     '+4 Laps', '+5 Laps', '+6 Laps', ''}
                if status not in finished_statuses:
                    d_num = result.get('DriverNumber')
                    if pd.isna(d_num):
                        continue
                    abbr = _driver_abbr(abbr_map, d_num)
                    d_laps = laps[laps['DriverNumber'] == d_num]
                    if len(d_laps) > 0:
                        last = d_laps.iloc[-1]
                        if pd.notna(last.get('Time')):
                            t_ms = int(last['Time'].total_seconds() * 1000)
                            events.append({
                                'time_ms': t_ms, 'type': 'dnf',
                                'driver': abbr, 'reason': status,
                                'message': f"ABANDONA  {abbr}  {status}"
                            })
    except Exception as e:
        print(f"[events] No se pudo extraer DNFs: {e}")

    # ── Safety Car / Track Status ─────────────────────────────────────────────
    try:
        ts_data = session.track_status_data
        if ts_data is not None and len(ts_data) > 0:
            sc_messages = {
                '2': 'BANDERA AMARILLA',
                '4': 'SAFETY CAR',
                '5': 'BANDERA ROJA',
                '6': 'VIRTUAL SAFETY CAR',
                '7': 'VSC FINALIZANDO',
                '1': 'PISTA DESPEJADA',
            }
            prev_status = '1'
            for _, row in ts_data.iterrows():
                status_code = str(row.get('Status', '1'))
                msg = sc_messages.get(status_code)
                if msg and status_code != prev_status:
                    t_ms = int(row['Time'].total_seconds() * 1000)
                    events.append({
                        'time_ms': t_ms, 'type': 'track_status',
                        'message': msg
                    })
                    prev_status = status_code
    except Exception as e:
        print(f"[events] No se pudo extraer track status: {e}")

    return sorted(events, key=lambda e: e['time_ms'])


def compute_position_snapshots(session) -> list[tuple]:
    """
    Returns list of (time_ms, {driver_num_str: {pos, lap}}).
    A snapshot is created whenever any driver completes a lap.
    Uses FastF1's own Position column for accuracy.
    """
    laps = session.laps.copy()
    race_laps = laps[laps['LapNumber'] >= 1].copy()

    # Collect all lap-completion timestamps
    completion_times = set()
    for _, lap in race_laps.iterrows():
        if pd.notna(lap.get('LapTime')) and pd.notna(lap.get('LapStartTime')):
            t_ms = int((lap['LapStartTime'] + lap['LapTime']).total_seconds() * 1000)
            completion_times.add(t_ms)

    all_driver_nums = race_laps['DriverNumber'].unique()

    snapshots = []
    for t_ms in sorted(completion_times):
        t = pd.Timedelta(milliseconds=t_ms)
        snapshot = {}

        for d_num in all_driver_nums:
            d_str = str(int(d_num))
            d_laps = race_laps[race_laps['DriverNumber'] == d_num]

            completed = d_laps[
                d_laps.apply(
                    lambda r: pd.notna(r.get('LapTime')) and
                              pd.notna(r.get('LapStartTime')) and
                              (r['LapStartTime'] + r['LapTime']) <= t,
                    axis=1
                )
            ]

            if len(completed) > 0:
                last = completed.iloc[-1]
                pos = int(last['Position']) if pd.notna(last.get('Position')) else None
                lap_n = int(last['LapNumber']) if pd.notna(last.get('LapNumber')) else None
            else:
                pos = None
                lap_n = 0

            snapshot[d_str] = {'pos': pos, 'lap': lap_n}

        snapshots.append((t_ms, snapshot))

    return snapshots
