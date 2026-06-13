import pandas as pd

def normalize_coordinates(df:pd.DataFrame) -> pd.DataFrame:
    x_min, x_max = df['X'].min(),df['X'].max()
    y_min, y_max = df['Y'].min(),df['Y'].max()

    x_range = x_max - x_min
    y_range = y_max - y_min
    max_range = max(x_range,y_range)

    df['norm_x'] = ((df['X'] - x_min)/max_range)*1000
    df['norm_y'] = 1000 - (((df['Y'] - y_min)/max_range)*1000)
    

    return df
    