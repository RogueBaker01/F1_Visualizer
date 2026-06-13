import pandas as pd


def get_normalization_params(df: pd.DataFrame) -> dict:
    """Compute normalization params from the full position DataFrame."""
    x_min, x_max = df['X'].min(), df['X'].max()
    y_min, y_max = df['Y'].min(), df['Y'].max()
    max_range = max(x_max - x_min, y_max - y_min)
    return {'x_min': float(x_min), 'y_min': float(y_min), 'max_range': float(max_range)}


def normalize_coordinates(df: pd.DataFrame, params: dict) -> pd.DataFrame:
    """Apply normalization to X/Y → x_norm/y_norm (0-1000 range)."""
    df = df.copy()
    df['x_norm'] = ((df['X'] - params['x_min']) / params['max_range']) * 1000
    df['y_norm'] = 1000 - (((df['Y'] - params['y_min']) / params['max_range']) * 1000)
    return df


def extract_circuit_path(session, params: dict) -> list[dict]:
    """
    Returns a list of {x, y} normalized points tracing one clean lap —
    used to render the circuit outline on the SVG.
    """
    try:
        laps = session.laps
        # Use lap 2 of fastest driver for a clean circuit trace
        for lap_num in [2, 3, 1]:
            lap_subset = laps[laps['LapNumber'] == lap_num].dropna(subset=['LapTime'])
            if len(lap_subset) > 0:
                break
        else:
            return []

        best_lap = lap_subset.sort_values('LapTime').iloc[0]
        driver_num = str(int(best_lap['DriverNumber']))

        # Fallback if driver not in pos_data
        if driver_num not in session.pos_data:
            driver_num = list(session.pos_data.keys())[0]

        pos = session.pos_data[driver_num]
        start_t = best_lap['LapStartTime']
        end_t = start_t + best_lap['LapTime']
        lap_pos = pos[(pos['Time'] >= start_t) & (pos['Time'] < end_t)].copy()

        if len(lap_pos) < 20:
            return []

        # Normalize coordinates
        lap_pos['x_n'] = ((lap_pos['X'] - params['x_min']) / params['max_range']) * 1000
        lap_pos['y_n'] = 1000 - (((lap_pos['Y'] - params['y_min']) / params['max_range']) * 1000)

        # Sample every 3rd point for smooth but compact path
        sampled = lap_pos.iloc[::3]
        return [{'x': round(float(r['x_n']), 1), 'y': round(float(r['y_n']), 1)}
                for _, r in sampled.iterrows()]

    except Exception as e:
        print(f"[transform] Circuit path extraction failed: {e}")
        return []


def get_race_start_ms(session) -> int:
    """Returns ms offset of the green lights moment (LapNumber == 1 start)."""
    try:
        lap1 = session.laps[session.laps['LapNumber'] == 1]['LapStartTime']
        return int(lap1.min().total_seconds() * 1000)
    except Exception:
        return 0


def get_total_laps(session) -> int:
    try:
        return int(session.laps['LapNumber'].max())
    except Exception:
        return 57