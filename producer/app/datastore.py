import redis
import json
import pandas as pd
import os

REDIS_HOST = os.getenv('REDIS_HOST','localhost')
redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

def load_to_redis(race_id: str, df: pd.DataFrame):
    grouped = df.groupby('Time')
    pipeline = redis_client.pipeline()
    for time_delta, group_df in grouped:
        time_ms = int(time_delta.total_seconds() * 1000)
        positions = []

        for _, row in group_df.iterrows():
            positions.append({
                "driver_id": str(row['Driver']),
                "x": float(row['x_norm']),
                "y": float(row['y_norm'])
            })
        redis_key = f"race:{race_id}:frame={time_ms}"
        pipeline.set(redis_key, json.dumps(positions))
    pipeline.execute()