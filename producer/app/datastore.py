import redis
import json
import pandas as pd
import os

REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)


def store_meta(race_id: str, meta: dict):
    """Stores circuit path, race start and total laps."""
    redis_client.set(f"race:{race_id}:meta", json.dumps(meta))
    print(f"[datastore] Meta stored ({len(meta.get('circuit_path', []))} circuit points)")


def store_events(race_id: str, events: list[dict]):
    """Stores events in a sorted set (score = time_ms)."""
    if not events:
        return
    events_key = f"race:{race_id}:events"
    pipeline = redis_client.pipeline()
    for event in events:
        member = json.dumps(event, ensure_ascii=False)
        pipeline.zadd(events_key, {member: event['time_ms']})
    pipeline.execute()
    print(f"[datastore] {len(events)} events stored")


def store_position_snapshots(race_id: str, snapshots: list[tuple]):
    """
    Stores position snapshots.
    Each snapshot: race:{id}:snap:{time_ms} = JSON {driver_num: {pos, lap}}
    Index:         race:{id}:snap:index sorted set
    """
    if not snapshots:
        return
    index_key = f"race:{race_id}:snap:index"
    pipeline = redis_client.pipeline()
    for t_ms, snapshot in snapshots:
        pipeline.set(f"race:{race_id}:snap:{t_ms}", json.dumps(snapshot))
        pipeline.zadd(index_key, {str(t_ms): t_ms})
    pipeline.execute()
    print(f"[datastore] {len(snapshots)} position snapshots stored")


def load_to_redis(race_id: str, df: pd.DataFrame):
    """Stores telemetry frames + frame index."""
    grouped = df.groupby('Time')
    index_key = f"race:{race_id}:index"
    pipeline = redis_client.pipeline()

    for time_delta, group_df in grouped:
        time_ms = int(time_delta.total_seconds() * 1000)
        positions = []
        for _, row in group_df.iterrows():
            positions.append({
                "driver_id": str(row['Driver']),
                "x": float(row['x_norm']),
                "y": float(row['y_norm']),
            })
        redis_key = f"race:{race_id}:frame={time_ms}"
        pipeline.set(redis_key, json.dumps(positions))
        pipeline.zadd(index_key, {str(time_ms): time_ms})

    pipeline.execute()
    print(f"[datastore] {grouped.ngroups} frames stored")