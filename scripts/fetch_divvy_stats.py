from datetime import datetime
import io
import json
from pathlib import Path
import re
import sqlite3
from typing import Optional, Union, Any
import xml.etree.ElementTree as ET
import zipfile

import pandas as pd
import requests


DIVVY_BUCKET_NAME = "divvy-tripdata"
DIVVY_TABLE_NAME = "trips"
FILENAME_PATTERN = re.compile(r"\d{6}-divvy-tripdata\.zip")
OUTFILE_NAME = "divvy-stats.json"


def download_monthly_zipfile(name: str) -> Optional[Path]:
    resp = requests.get(f"https://{DIVVY_BUCKET_NAME}.s3.amazonaws.com/{name}")
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        for fp in zf.filelist:
            if not fp.filename.endswith(".csv"):
                continue

            zf.extract(fp)
            return Path(fp.filename)


def list_all_bucket_keys() -> list[str]:
    resp = requests.get(f"https://{DIVVY_BUCKET_NAME}.s3.amazonaws.com")
    if resp.status_code != 200:
        raise Exception("Failed getting bucket objects")

    root = ET.fromstring(resp.content)

    keys = [elem.text for elem in root.iter('{http://s3.amazonaws.com/doc/2006-03-01/}Key') if elem.text]
    return [key for key in keys if FILENAME_PATTERN.match(key)]


def get_most_recent_filename() -> Optional[str]:
    return sorted(list_all_bucket_keys())[-1]


def load_csv_files_to_sqlite(conn: sqlite3.Connection, raw_data_fp: Path) -> None:
    if raw_data_fp.is_file():
        to_load = [raw_data_fp]
    else:
        to_load = [fp for fp in raw_data_fp.glob("*.csv") if fp.is_file()]

    for fp in to_load:
        df = pd.read_csv(fp)
        df.to_sql(DIVVY_TABLE_NAME, conn, if_exists="append", index=False)

        print(f"Loaded '{fp}'")


def calculate_revenue(row):
    base_rate = 0
    minute_rate = 0
    ride_duration = row['ride_duration']

    if row['member_casual'] == 'member':
        if row['rideable_type'] == 'electric_bike':
            minute_rate = 0.18
        elif row['rideable_type'] == 'classic_bike':
            if ride_duration > 45:
                ride_duration -= 45
                minute_rate = 0.18
    elif row['member_casual'] == 'casual':
        base_rate = 1
        if row['rideable_type'] == 'electric_bike':
            minute_rate = 0.44
        elif row['rideable_type'] == 'classic_bike':
            minute_rate = 0.18

    revenue = base_rate + (minute_rate * ride_duration)

    # Add $1.20 if end_station_name is NA
    if pd.isna(row['end_station_name']):
        revenue += 1.20

    return revenue


def categorize_time_of_day(hour):
    if 5 <= hour < 12:
        return 'Morning'
    elif 12 <= hour < 17:
        return 'Afternoon'
    elif 17 <= hour < 21:
        return 'Evening'
    else:
        return 'Night'


def calculate_station_activity(df: pd.DataFrame) -> pd.DataFrame:
    total_rides = len(df)

    start_station_counts = df['start_station_name'].value_counts().head(10)
    start_station_percentages = (start_station_counts / total_rides) * 100

    start_station_stats = pd.DataFrame({
        'station_name': start_station_counts.index,
        'start_ride_count': start_station_counts.values,
        'start_ride_percent': start_station_percentages.values
    })

    end_station_counts = df['end_station_name'].value_counts().head(10)
    end_station_percentages = (end_station_counts / total_rides) * 100

    end_station_stats = pd.DataFrame({
        'station_name': end_station_counts.index,
        'end_ride_count': end_station_counts.values,
        'end_ride_percent': end_station_percentages.values
    })

    combined_stats = pd.merge(start_station_stats, end_station_stats, on='station_name', how='outer')

    # Calculate overall ride count for each station
    combined_stats['total_ride_count'] = combined_stats[['start_ride_count', 'end_ride_count']].sum(axis=1).fillna(0)

    # Calculate the percentage of total rides for each station
    combined_stats['total_ride_percent'] = (combined_stats['total_ride_count'] / total_rides) * 100

    # Select relevant columns
    combined_stats = combined_stats[['station_name', 'total_ride_count', 'total_ride_percent']]
    combined_stats = combined_stats.sort_values(by='total_ride_count', ascending=False)
    return combined_stats


def calculate_rides_by_membership(df: pd.DataFrame) -> pd.DataFrame:
    total_rides = len(df)
    member_casual_counts = df['member_casual'].value_counts()

    member_casual_percentages = (member_casual_counts / total_rides) * 100

    # Combine counts and percentages into a DataFrame
    return pd.DataFrame({
        'ride_count': member_casual_counts,
        'ride_percent': member_casual_percentages
    })


def df_to_json(df: Union[pd.DataFrame, pd.Series]) -> Any:
    index_name = df.index.name
    df_reset = df.reset_index()
    df_reset.rename(columns={'index': index_name}, inplace=True)

    return json.loads(df_reset.to_json(orient="records"))


def generate_analysis_json(conn: sqlite3.Connection, as_of_month: str) -> Path:
    result = {
        "meta": {"as_of": as_of_month},
        "stats": {}
    }

    df = pd.read_sql("SELECT * FROM trips", conn)

    df['started_at'] = pd.to_datetime(df['started_at'], errors='coerce')
    df['ended_at'] = pd.to_datetime(df['ended_at'], errors='coerce')
    df['ride_duration'] = (df['ended_at'] - df['started_at']).dt.total_seconds() / 60
    df['time_of_day'] = df['started_at'].dt.hour.apply(categorize_time_of_day)
    df['estimated_revenue'] = df.apply(calculate_revenue, axis=1)
    total_rides = len(df)

    station_activity = calculate_station_activity(df)
    result["stats"]["station_activity"] = json.loads(station_activity.to_json(orient="records"))

    average_ride_duration = df.groupby('member_casual')['ride_duration'].mean()
    result["stats"]["average_ride_duration"] = df_to_json(average_ride_duration)

    rides_by_membership = calculate_rides_by_membership(df)
    result["stats"]["rides_by_membership"] = df_to_json(rides_by_membership)

    total_estimated_revenue = df['estimated_revenue'].sum()
    result["stats"]["total_estimated_revenue"] = total_estimated_revenue

    average_revenue_per_trip = df.groupby('member_casual')['estimated_revenue'].mean()
    result["stats"]["average_revenue_per_trip"] = df_to_json(average_revenue_per_trip)

    total_revenue_by_type = df.groupby('member_casual')['estimated_revenue'].sum()
    revenue_percentage_by_membership = (total_revenue_by_type / total_estimated_revenue) * 100

    # Combine total revenue and percentage into a DataFrame
    revenue_stats = pd.DataFrame({
        'total_revenue': total_revenue_by_type,
        'percent_revenue': revenue_percentage_by_membership
    })
    result["stats"]["revenue_by_membership"] = df_to_json(revenue_stats)

    trip_counts_by_time_of_day = df['time_of_day'].value_counts()

    trip_percentage_by_time_of_day = (trip_counts_by_time_of_day / total_rides) * 100
    time_of_day_stats = pd.DataFrame({
        'ride_count': trip_counts_by_time_of_day,
        'ride_percent': trip_percentage_by_time_of_day
    })
    result["stats"]["trips_by_time_of_day"] = df_to_json(time_of_day_stats)

    revenue_by_time_of_day = df.groupby('time_of_day')['estimated_revenue'].sum()

    revenue_percentage = (revenue_by_time_of_day / total_estimated_revenue) * 100

    revenue_stats = pd.DataFrame({
        'total_revenue': revenue_by_time_of_day,
        'revenue_percentage': revenue_percentage
    })
    result["stats"]["revenue_by_time_of_date"] = df_to_json(revenue_stats)

    outfile = Path(OUTFILE_NAME)
    with open(outfile, "w") as fd:
        fd.write(json.dumps(result))

    return outfile


def main() -> None:
    filename = get_most_recent_filename()
    if not filename:
        raise Exception("Could not find most recent filename")

    print(f"Most recent filename: '{filename}'")

    date_section, *_ = filename.split("-", maxsplit=1)
    file_date = datetime.strptime(date_section, "%Y%m")

    fp = download_monthly_zipfile(filename)
    if not fp:
        raise Exception(f"Failed to download most recent datafile, '{filename}'")

    print("Downloaded monthly data file")

    conn = sqlite3.connect(f"divvy_data_{date_section}.db")
    load_csv_files_to_sqlite(conn, fp)

    print("Data loaded to sqlite")

    generate_analysis_json(conn, file_date.strftime("%b %Y"))

    print("Analysis generated")

    conn.close()


if __name__ == "__main__":
    main()
