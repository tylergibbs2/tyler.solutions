#!/usr/bin/env uv run --script
# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "geopandas==1.1.1",
#   "pandas==2.3.2",
#   "requests==2.32.5"
# ]
# ///
from datetime import datetime
import io
import json
from pathlib import Path
import re
import sqlite3
from typing import Optional, Union, Any
import xml.etree.ElementTree as ET
import zipfile
import time

import geopandas as gpd
import pandas as pd
import requests


DIVVY_BUCKET_NAME = "divvy-tripdata"
DIVVY_TABLE_NAME = "trips"
NEIGHBORHOOD_SHAPEFILE_LINK = "https://github.com/tylergibbs2/tyler.solutions/raw/refs/heads/master/scripts/Neighborhoods_2012b_20241217.zip"
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


def download_neighborhood_shapefile() -> Optional[Path]:
    resp = requests.get(NEIGHBORHOOD_SHAPEFILE_LINK)
    if resp.status_code != 200:
        raise Exception("Error downloading City of Chicago neighborhood data")
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        shapefile_fp = None
        for zf_fp in zf.filelist:
            if zf_fp.filename.endswith(".shp"):
                shapefile_fp = zf_fp.filename
                break

        if shapefile_fp is None:
            return

        zf.extractall()

    return Path(shapefile_fp)


def list_all_bucket_keys() -> list[str]:
    resp = requests.get(f"https://{DIVVY_BUCKET_NAME}.s3.amazonaws.com")
    if resp.status_code != 200:
        raise Exception("Failed getting bucket objects")

    root = ET.fromstring(resp.content)

    keys = [
        elem.text
        for elem in root.iter("{http://s3.amazonaws.com/doc/2006-03-01/}Key")
        if elem.text
    ]
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


def get_neighborhoods(df: pd.DataFrame, shapefile_fp: Path) -> pd.DataFrame:
    neighborhoods = gpd.read_file(shapefile_fp)

    # Prepare unique start points
    start_points = df[["start_lat", "start_lng"]].drop_duplicates().copy()
    start_gdf = gpd.GeoDataFrame(
        start_points,
        geometry=gpd.points_from_xy(start_points.start_lng, start_points.start_lat),
        crs=neighborhoods.crs,
    )
    start_neigh = gpd.sjoin(
        start_gdf,
        neighborhoods[["pri_neigh", "geometry"]],
        how="left",
        predicate="within",
    )[["start_lat", "start_lng", "pri_neigh"]]
    start_neigh = start_neigh.rename(columns={"pri_neigh": "start_neighborhood"})

    # Prepare unique end points
    end_points = df[["end_lat", "end_lng"]].drop_duplicates().copy()
    end_gdf = gpd.GeoDataFrame(
        end_points,
        geometry=gpd.points_from_xy(end_points.end_lng, end_points.end_lat),
        crs=neighborhoods.crs,
    )
    end_neigh = gpd.sjoin(
        end_gdf,
        neighborhoods[["pri_neigh", "geometry"]],
        how="left",
        predicate="within",
    )[["end_lat", "end_lng", "pri_neigh"]]
    end_neigh = end_neigh.rename(columns={"pri_neigh": "end_neighborhood"})

    # Merge back to main DataFrame
    df = df.merge(start_neigh, on=["start_lat", "start_lng"], how="left")
    df = df.merge(end_neigh, on=["end_lat", "end_lng"], how="left")
    return df


def calculate_revenue_vectorized(df: pd.DataFrame) -> pd.Series:
    # Base rates and minute rates
    base_rate = pd.Series(0, index=df.index, dtype=float)
    minute_rate = pd.Series(0, index=df.index, dtype=float)
    ride_duration = df["ride_duration"].copy()

    # Member logic
    is_member = df["member_casual"] == "member"
    is_electric = df["rideable_type"] == "electric_bike"
    is_classic = df["rideable_type"] == "classic_bike"

    # Member, electric
    minute_rate.loc[is_member & is_electric] = 0.18
    # Member, classic, over 45 min
    classic_long = is_member & is_classic & (ride_duration > 45)
    minute_rate.loc[classic_long] = 0.18
    ride_duration.loc[classic_long] = ride_duration.loc[classic_long] - 45

    # Casual logic
    is_casual = df["member_casual"] == "casual"
    base_rate.loc[is_casual] = 1
    minute_rate.loc[is_casual & is_electric] = 0.44
    minute_rate.loc[is_casual & is_classic] = 0.18

    revenue = base_rate + (minute_rate * ride_duration)
    # Add $1.20 if end_station_name is NA
    revenue = revenue + df["end_station_name"].isna() * 1.20
    return revenue


def categorize_time_of_day(hour):
    if 5 <= hour < 12:
        return "Morning"
    elif 12 <= hour < 17:
        return "Afternoon"
    elif 17 <= hour < 21:
        return "Evening"
    else:
        return "Night"


def calculate_station_activity(df: pd.DataFrame) -> pd.DataFrame:
    total_rides = len(df)

    start_station_counts = df["start_station_name"].value_counts().head(10)
    start_station_percentages = (start_station_counts / total_rides) * 100

    start_station_stats = pd.DataFrame(
        {
            "station_name": start_station_counts.index,
            "start_ride_count": start_station_counts.values,
            "start_ride_percent": start_station_percentages.values,
        }
    )

    end_station_counts = df["end_station_name"].value_counts().head(10)
    end_station_percentages = (end_station_counts / total_rides) * 100

    end_station_stats = pd.DataFrame(
        {
            "station_name": end_station_counts.index,
            "end_ride_count": end_station_counts.values,
            "end_ride_percent": end_station_percentages.values,
        }
    )

    combined_stats = pd.merge(
        start_station_stats, end_station_stats, on="station_name", how="outer"
    )

    # Calculate overall ride count for each station
    combined_stats["total_ride_count"] = (
        combined_stats[["start_ride_count", "end_ride_count"]].sum(axis=1).fillna(0)
    )

    # Calculate the percentage of total rides for each station
    combined_stats["total_ride_percent"] = (
        combined_stats["total_ride_count"] / total_rides
    ) * 100

    # Select relevant columns
    combined_stats = combined_stats[
        ["station_name", "total_ride_count", "total_ride_percent"]
    ]
    combined_stats = combined_stats.sort_values(by="total_ride_count", ascending=False)
    return combined_stats


def calculate_popular_routes(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate the most popular routes (start station -> end station pairs)"""
    # Filter out round trips (start station == end station)
    df_filtered = df[df["start_station_name"] != df["end_station_name"]].copy()
    
    # Create route column
    df_filtered["route"] = df_filtered["start_station_name"] + " → " + df_filtered["end_station_name"]
    
    # Count routes and calculate percentages
    route_counts = df_filtered["route"].value_counts().head(10)
    total_rides = len(df_filtered)
    route_percentages = (route_counts / total_rides) * 100
    
    return pd.DataFrame({
        "route": route_counts.index,
        "ride_count": route_counts.values,
        "ride_percent": route_percentages.values
    })


def calculate_peak_hours(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate hourly usage patterns"""
    # Extract hour from started_at
    df["hour"] = df["started_at"].dt.hour
    
    # Count rides by hour
    hourly_counts = df["hour"].value_counts().sort_index()
    total_rides = len(df)
    hourly_percentages = (hourly_counts / total_rides) * 100
    
    # Calculate average revenue by hour
    hourly_revenue = df.groupby("hour")["estimated_revenue"].mean()
    
    return pd.DataFrame({
        "hour": hourly_counts.index,
        "ride_count": hourly_counts.values,
        "ride_percent": hourly_percentages.values,
        "avg_revenue": hourly_revenue.values
    })


def calculate_station_efficiency(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate station efficiency metrics including turnover rates"""
    total_rides = len(df)
    
    # Calculate start and end counts for each station
    start_counts = df["start_station_name"].value_counts()
    end_counts = df["end_station_name"].value_counts()
    
    # Combine into efficiency dataframe
    efficiency_df = pd.DataFrame({
        "station_name": start_counts.index,
        "start_count": start_counts.values,
        "end_count": end_counts.reindex(start_counts.index).fillna(0).values
    })
    
    # Calculate efficiency metrics
    efficiency_df["total_activity"] = efficiency_df["start_count"] + efficiency_df["end_count"]
    efficiency_df["net_flow"] = efficiency_df["end_count"] - efficiency_df["start_count"]
    efficiency_df["turnover_rate"] = efficiency_df["total_activity"] / total_rides * 100
    
    # Calculate utilization (how balanced start/end activity is)
    efficiency_df["utilization_score"] = 1 - abs(efficiency_df["net_flow"]) / efficiency_df["total_activity"]
    
    # Sort by total activity and get top 10
    efficiency_df = efficiency_df.sort_values("total_activity", ascending=False).head(10)
    
    return efficiency_df[["station_name", "total_activity", "net_flow", "turnover_rate", "utilization_score"]]


def calculate_neighborhood_stations(df: pd.DataFrame) -> dict:
    """Calculate top stations per neighborhood and prepare map data for ALL neighborhoods"""
    # Get all neighborhoods by activity (not just top 10)
    neighborhood_activity = calculate_rides_by_neighborhood(df)
    
    # For each neighborhood, get top stations
    neighborhood_stations = {}
    
    for neighborhood in neighborhood_activity.index:
        # Filter trips starting in this neighborhood
        neighborhood_trips = df[df["start_neighborhood"] == neighborhood]
        
        if len(neighborhood_trips) > 0:
            # Get top stations in this neighborhood
            top_stations = neighborhood_trips["start_station_name"].value_counts().head(3)
            
            neighborhood_stations[neighborhood] = {
                "total_rides": int(neighborhood_activity.loc[neighborhood, "ride_count"]),
                "ride_percent": float(neighborhood_activity.loc[neighborhood, "ride_percent"]),
                "top_stations": [
                    {
                        "station_name": station,
                        "ride_count": int(count),
                        "ride_percent": round((count / len(neighborhood_trips) * 100), 2)
                    }
                    for station, count in top_stations.items()
                ]
            }
        else:
            # Still include neighborhoods with no trips
            neighborhood_stations[neighborhood] = {
                "total_rides": 0,
                "ride_percent": 0.0,
                "top_stations": []
            }
    
    return neighborhood_stations


def generate_svg_map_data(shapefile_fp: Path, neighborhood_stations: dict) -> str:
    """Generate SVG map data from shapefile"""
    import geopandas as gpd
    
    # Read the shapefile
    neighborhoods = gpd.read_file(shapefile_fp)
    
    # Convert to Web Mercator for consistent projection
    neighborhoods_web = neighborhoods.to_crs(epsg=3857)
    
    # Get the bounding box
    bounds = neighborhoods_web.total_bounds
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    
    # Scale to fit in a reasonable SVG size (800x600)
    scale = min(800 / width, 600 / height)
    
    # Generate SVG
    svg_parts = []
    svg_parts.append(
        f'<svg width="800" height="600" viewBox="{bounds[0]} {bounds[1]} {width} {height}" '
        'xmlns="http://www.w3.org/2000/svg" '
        'style="transform: scaleY(-1); transform-origin: center;">'
    )
    svg_parts.append('<defs>')
    svg_parts.append('<style>')
    svg_parts.append('.neighborhood { fill: #1a1a1a; stroke: #63a4ff; stroke-width: 1; cursor: pointer; }')
    svg_parts.append('.neighborhood:hover { fill: #2a2a2a; }')
    svg_parts.append('.neighborhood.active { fill: #63a4ff; }')
    svg_parts.append('.neighborhood-label { font-family: monospace; font-size: 8px; fill: #9c9c9c; pointer-events: none; }')
    svg_parts.append('</style>')
    svg_parts.append('</defs>')
    # Add each neighborhood
    for idx, row in neighborhoods_web.iterrows():
        neighborhood_name = row['pri_neigh']
        
        # Get the geometry
        geom = row.geometry
        
        if geom.geom_type == 'Polygon':
            coords = list(geom.exterior.coords)
            path_data = "M " + " L ".join([f"{x} {y}" for x, y in coords]) + " Z"
        elif geom.geom_type == 'MultiPolygon':
            paths = []
            for poly in geom.geoms:
                coords = list(poly.exterior.coords)
                path_data = "M " + " L ".join([f"{x} {y}" for x, y in coords]) + " Z"
                paths.append(path_data)
            path_data = " ".join(paths)
        else:
            continue
        
        # Add the neighborhood polygon
        svg_parts.append(f'<path class="neighborhood" d="{path_data}" data-neighborhood="{neighborhood_name}"/>')
        
        # Add label for neighborhoods with activity
        if neighborhood_name in neighborhood_stations and neighborhood_stations[neighborhood_name]["total_rides"] > 0:
            centroid = geom.centroid
            svg_parts.append(f'<text x="{centroid.x}" y="{centroid.y}" class="neighborhood-label" text-anchor="middle">{neighborhood_name}</text>')
    # Close the group before closing SVG
    svg_parts.append('</svg>')
    
    return "\n".join(svg_parts)


def calculate_rides_by_membership(df: pd.DataFrame) -> pd.DataFrame:
    total_rides = len(df)
    member_casual_counts = df["member_casual"].value_counts()

    member_casual_percentages = (member_casual_counts / total_rides) * 100

    # Combine counts and percentages into a DataFrame
    return pd.DataFrame(
        {"ride_count": member_casual_counts, "ride_percent": member_casual_percentages}
    )


def calculate_rides_by_neighborhood(df: pd.DataFrame) -> pd.DataFrame:
    total_rides = len(df)

    start_neighborhood_counts = df["start_neighborhood"].value_counts()

    start_neighborhood_percentages = (start_neighborhood_counts / total_rides) * 100

    return pd.DataFrame(
        {
            "ride_count": start_neighborhood_counts,
            "ride_percent": start_neighborhood_percentages,
        }
    )


def df_to_json(df: Union[pd.DataFrame, pd.Series]) -> Any:
    index_name = df.index.name
    df_reset = df.reset_index()
    df_reset.rename(columns={"index": index_name}, inplace=True)

    return json.loads(df_reset.to_json(orient="records"))


def generate_analysis_json(
    conn: sqlite3.Connection, as_of_month: str, shapefile_fp: Path
) -> Path:
    print("Reading trips from SQLite...")
    result = {"meta": {"as_of": as_of_month}, "stats": {}}

    df = pd.read_sql("SELECT * FROM trips", conn)

    print("Processing trip data...")
    df["started_at"] = pd.to_datetime(df["started_at"], errors="coerce")
    df["ended_at"] = pd.to_datetime(df["ended_at"], errors="coerce")
    df["ride_duration"] = (df["ended_at"] - df["started_at"]).dt.total_seconds() / 60
    df["time_of_day"] = df["started_at"].dt.hour.apply(categorize_time_of_day)
    df["estimated_revenue"] = calculate_revenue_vectorized(df)
    total_rides = len(df)

    print("Assigning neighborhoods to trips...")
    df = get_neighborhoods(df, shapefile_fp)

    # Timed stat calculations
    t0 = time.time()
    print("Calculating neighborhood activity...")
    result["stats"]["neighborhood_activity"] = df_to_json(
        calculate_rides_by_neighborhood(df).head(10)
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating station activity...")
    station_activity = calculate_station_activity(df)
    result["stats"]["station_activity"] = json.loads(
        station_activity.to_json(orient="records")
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating popular routes...")
    popular_routes = calculate_popular_routes(df)
    result["stats"]["popular_routes"] = json.loads(
        popular_routes.to_json(orient="records")
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating peak hours...")
    peak_hours = calculate_peak_hours(df)
    result["stats"]["peak_hours"] = json.loads(
        peak_hours.to_json(orient="records")
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating station efficiency...")
    station_efficiency = calculate_station_efficiency(df)
    result["stats"]["station_efficiency"] = json.loads(
        station_efficiency.to_json(orient="records")
    )
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating neighborhood stations and generating SVG map...")
    neighborhood_stations = calculate_neighborhood_stations(df)
    result["stats"]["neighborhood_stations"] = neighborhood_stations
    svg_map = generate_svg_map_data(shapefile_fp, neighborhood_stations)
    result["stats"]["neighborhood_svg_map"] = svg_map
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating ride duration and revenue stats...")
    average_ride_duration = df.groupby("member_casual")["ride_duration"].mean()
    result["stats"]["average_ride_duration"] = df_to_json(average_ride_duration)

    rides_by_membership = calculate_rides_by_membership(df)
    result["stats"]["rides_by_membership"] = df_to_json(rides_by_membership)

    total_estimated_revenue = df["estimated_revenue"].sum()
    result["stats"]["total_estimated_revenue"] = total_estimated_revenue

    average_revenue_per_trip = df.groupby("member_casual")["estimated_revenue"].mean()
    result["stats"]["average_revenue_per_trip"] = df_to_json(average_revenue_per_trip)

    total_revenue_by_type = df.groupby("member_casual")["estimated_revenue"].sum()
    revenue_percentage_by_membership = (
        total_revenue_by_type / total_estimated_revenue
    ) * 100

    # Combine total revenue and percentage into a DataFrame
    revenue_stats = pd.DataFrame(
        {
            "total_revenue": total_revenue_by_type,
            "percent_revenue": revenue_percentage_by_membership,
        }
    )
    result["stats"]["revenue_by_membership"] = df_to_json(revenue_stats)
    print(f"  Done in {time.time() - t0:.2f}s")

    t0 = time.time()
    print("Calculating time of day stats...")
    trip_counts_by_time_of_day = df["time_of_day"].value_counts()

    trip_percentage_by_time_of_day = (trip_counts_by_time_of_day / total_rides) * 100
    time_of_day_stats = pd.DataFrame(
        {
            "ride_count": trip_counts_by_time_of_day,
            "ride_percent": trip_percentage_by_time_of_day,
        }
    )
    result["stats"]["trips_by_time_of_day"] = df_to_json(time_of_day_stats)

    revenue_by_time_of_day = df.groupby("time_of_day")["estimated_revenue"].sum()

    revenue_percentage = (revenue_by_time_of_day / total_estimated_revenue) * 100

    revenue_stats = pd.DataFrame(
        {
            "total_revenue": revenue_by_time_of_day,
            "revenue_percentage": revenue_percentage,
        }
    )
    result["stats"]["revenue_by_time_of_date"] = df_to_json(revenue_stats)
    print(f"  Done in {time.time() - t0:.2f}s")

    outfile = Path(OUTFILE_NAME)
    print(f"Writing output to {outfile}...")
    with open(outfile, "w") as fd:
        fd.write(json.dumps(result))

    print("Done writing output.")
    return outfile


def main() -> None:
    print("Finding most recent Divvy data file...")
    filename = get_most_recent_filename()
    if not filename:
        raise Exception("Could not find most recent filename")

    print(f"Most recent filename: '{filename}'")

    date_section, *_ = filename.split("-", maxsplit=1)
    file_date = datetime.strptime(date_section, "%Y%m")

    print("Downloading monthly data file...")
    fp = download_monthly_zipfile(filename)
    if not fp:
        raise Exception(f"Failed to download most recent datafile, '{filename}'")

    print("Downloaded monthly data file")

    print("Downloading neighborhood shapefile...")
    shapefile_fp = download_neighborhood_shapefile()
    if not shapefile_fp:
        raise Exception(
            f"Failed to download neighboorhood shapefile map, '{NEIGHBORHOOD_SHAPEFILE_LINK}'"
        )

    print("Loading data into SQLite...")
    conn = sqlite3.connect(f"divvy_data_{date_section}.db")
    load_csv_files_to_sqlite(conn, fp)

    print("Data loaded to sqlite")

    print("Generating analysis JSON...")
    generate_analysis_json(conn, file_date.strftime("%b %Y"), shapefile_fp)

    print("Analysis generated")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
