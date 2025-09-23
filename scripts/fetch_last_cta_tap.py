#!/usr/bin/env uv run --script
# /// script
# requires-python = ">=3.11,<3.12"
# dependencies = [
#   "pytz==2025.2",
#   "requests==2.32.5"
# ]
# ///
from datetime import datetime
import json
import os
from pathlib import Path
import re
from typing import Optional, Any

import pytz
import requests


def get_verification_token(session: requests.Session, url: str) -> str:
    """Extract the verification token from the page"""
    response = session.get(url)
    if response.status_code != 200:
        raise Exception(f"Failed to get page: {response.status_code}")

    # Look for the verification token in the page
    token_pattern = r'name="hdnRequestVerificationToken" id="hdnRequestVerificationToken" value="([^"]+)"'
    match = re.search(token_pattern, response.text)
    if not match:
        raise Exception("Could not find verification token")

    return match.group(1)


def login_to_ventra(username: str, password: str) -> Optional[requests.Session]:
    """Login to Ventra Chicago website and return the session"""
    base_url = "https://www.ventrachicago.com/"
    login_url = "https://www.ventrachicago.com/"

    # Create a session to maintain cookies
    session = requests.Session()

    # Set headers to mimic a real browser
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:141.0) Gecko/20100101 Firefox/141.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
        }
    )

    try:
        # First, visit the main page to get session cookies and tokens
        print("Getting initial page and tokens...")
        verification_token = get_verification_token(session, base_url)
        print(f"Got verification token: {verification_token[:20]}...")

        # Prepare login data
        login_data = {
            "f": "search",
            "u": username,
            "p": password,
            "pc": "true",
            "__CALLBACKID": "CT_Header$ccHeaderLogin",
            "__CALLBACKPARAM": "",
            "__EVENTTARGET": "",
            "__EVENTARGUMENT": "",
            "__RequestVerificationToken": verification_token,
        }

        # Update headers for the POST request
        session.headers.update(
            {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://www.ventrachicago.com",
                "Referer": "https://www.ventrachicago.com/",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
            }
        )

        # Perform the login
        print("Attempting login...")
        response = session.post(login_url, data=login_data)

        print(f"Response status: {response.status_code}")
        print(f"Response content: {response.text[:500]}...")

        if response.status_code == 200:
            if "error" in response.text.lower():
                print("Login failed - error in response")
                return None
            else:
                print("Login appears successful!")
                return session
        else:
            print(f"Login failed with status code: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error during login: {e}")
        return None


def get_transaction_history(
    session: requests.Session, verification_token: str
) -> Optional[dict[str, Any]]:
    """Get transaction history using the authenticated session"""
    url = "https://www.ventrachicago.com/ajax/NAM.asmx/GetTransactionHistory"

    # Update headers for the transaction history request
    session.headers.update(
        {
            "Accept": "*/*",
            "Content-Type": "application/json",
            "Referer": "https://www.ventrachicago.com/account/transaction-history/",
            "RequestVerificationToken": verification_token,
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://www.ventrachicago.com",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
    )

    # Prepare the request data - only fetch fields we need for rail tap processing
    data = {
        "s": 1,
        "MaxNumberOfRows": "100",
        "TransitAccountId": os.environ["VENTRA_TRANSIT_ACCOUNT_ID"],
        "SelectedProduct": "",
        "SelectedTransactionType": "",
        "SelectedRange": 0,
        "Props": {
            "draw": 1,
            "columns": [
                {
                    "data": "TransactionDateFormatted",
                    "name": "",
                    "searchable": True,
                    "orderable": True,
                    "search": {"value": "", "regex": False},
                },
                {
                    "data": "TransactionType",
                    "name": "",
                    "searchable": True,
                    "orderable": True,
                    "search": {"value": "", "regex": False},
                },
                {
                    "data": "OperatorDesc",
                    "name": "",
                    "searchable": True,
                    "orderable": True,
                    "search": {"value": "", "regex": False},
                },
                {
                    "data": "LocationRoute",
                    "name": "",
                    "searchable": True,
                    "orderable": True,
                    "search": {"value": "", "regex": False},
                },
            ],
            "order": [{"column": 0, "dir": "desc"}],
            "start": 0,
            "length": 100,
            "search": {"value": "", "regex": False},
        },
    }

    try:
        print("Fetching transaction history...")
        response = session.post(url, json=data)
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to get transaction history: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error getting transaction history: {e}")
        return None


def format_date(date_string: str) -> str:
    """Convert Ventra date format from Chicago timezone to UTC ISO format"""
    try:
        # Remove HTML tags and clean up the date string
        clean_date = date_string.replace("<br/>", " ").strip()

        # Parse the date (format: MM/DD/YYYY HH:MM:SS AM/PM)
        # This is in Chicago timezone
        chicago_tz = pytz.timezone('America/Chicago')
        parsed_date = datetime.strptime(clean_date, "%m/%d/%Y %I:%M:%S %p")
        
        # Localize the datetime to Chicago timezone
        chicago_date = chicago_tz.localize(parsed_date)
        
        # Convert to UTC
        utc_date = chicago_date.astimezone(pytz.UTC)

        # Return UTC ISO format
        return utc_date.isoformat()
    except Exception as e:
        print(f"Error formatting date '{date_string}': {e}")
        return date_string


def get_rail_tap_history(transaction_data: dict[str, Any]) -> list[dict[str, str]]:
    """Extract all CTA Rail taps from transaction data"""
    try:
        transactions = transaction_data["d"]["result"]["data"]
        rail_taps = []

        # Find all "Use" transactions for "CTA Rail"
        for transaction in transactions:
            if (
                transaction["TransactionType"] in ("Use", "Transfer")
                and transaction["OperatorDesc"] == "CTA Rail"
            ):
                location_route = transaction["LocationRoute"]
                transaction_date = format_date(transaction["TransactionDateFormatted"])

                # Parse the location route to extract line and station
                # Handle various formats: "Line-Station", "Line_Station", "Line_Station-Station"
                if "-" in location_route:
                    parts = location_route.split("-", 1)
                    line = parts[0].split("_")[0]  # Take first part before any underscore
                    station = parts[1].replace("_", " ").replace("SS-", "").replace("DB ", "")
                elif "_" in location_route:
                    parts = location_route.split("_", 1)
                    line = parts[0]
                    station = parts[1].replace("_", " ")
                else:
                    line = "Unknown"
                    station = location_route

                rail_taps.append(
                    {
                        "line": line,
                        "station": station,
                        "date": transaction_date,
                        "location_route": location_route,
                        "original_location_route": transaction["LocationRoute"],
                    }
                )

        rail_taps.sort(key=lambda x: x["date"], reverse=True)

        return rail_taps

    except Exception as e:
        print(f"Error parsing transaction data: {e}")
        return []


def save_rail_tap_data(
    rail_taps: list[dict[str, str]], output_file: str = "cta-rail-taps.json"
) -> Path:
    """Save rail tap data to JSON file"""
    data = {
        "last_updated": datetime.now().isoformat(),
        "total_taps": len(rail_taps),
        "rail_taps": rail_taps,
    }

    output_path = Path(output_file)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(rail_taps)} rail taps to {output_path}")
    return output_path


if __name__ == "__main__":
    # Get credentials from environment variables or use defaults
    username = os.environ["VENTRA_USERNAME"]
    password = os.environ["VENTRA_PASSWORD"]

    # Login and get the authenticated session
    session = login_to_ventra(username, password)
    if session:
        print("Login successful!")

        # Get a fresh verification token for the transaction history request
        print("Getting fresh verification token for transaction history...")
        verification_token = get_verification_token(
            session, "https://www.ventrachicago.com/"
        )

        # Get transaction history using the authenticated session
        transaction_data = get_transaction_history(session, verification_token)

        if transaction_data:
            print("Successfully retrieved transaction history!")

            # Extract all CTA Rail taps
            rail_taps = get_rail_tap_history(transaction_data)
            if rail_taps:
                print(f"Found {len(rail_taps)} CTA Rail taps:")
                for i, tap in enumerate(rail_taps, 1):
                    print(f"{i}. {tap['line']} Line - {tap['station']} ({tap['date']}) - {tap['original_location_route']}")

                # Save to JSON file
                save_rail_tap_data(rail_taps)
            else:
                print("No CTA Rail taps found in recent transactions")
        else:
            print("Failed to get transaction history")
    else:
        print("Login failed!")
