"""
Scrapes Box Office Mojo's weekend-by-weekend charts.

Usage:
    python scraper/scrape_bom.py

Output:
    data/raw/bom_weekend_data.json
"""

import re
import time
import json
import os

import requests
import pandas as pd
from bs4 import BeautifulSoup

from utils import HEADERS, clean_money, clean_int, clean_str

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "bom_weekend_data.json")
SLEEP_SECONDS = 1.5  # be polite, avoid getting rate-limited/blocked


def get_weekend_urls_for_year(year):
    """Get list of weekend page URLs for a given year from the by-year index."""
    url = f"https://www.boxofficemojo.com/weekend/by-year/{year}/"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    weekend_links = []
    for a in soup.select("a[href*='/weekend/20']"):
        href = a["href"]
        if re.search(r"/weekend/\d{4}W\d{2}/", href):
            full_url = "https://www.boxofficemojo.com" + href
            if full_url not in weekend_links:
                weekend_links.append(full_url)
    return weekend_links


def parse_weekend_page(url):
    """Parse a single weekend page into a list of film-row dicts."""
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    table = soup.find("table")
    if table is None:
        return []

    df = pd.read_html(str(table))[0]
    df.columns = [str(c).strip() for c in df.columns]

    # Column names vary slightly between BOM page types - check both possibilities
    gross_col = "Gross" if "Gross" in df.columns else "Weekend"
    weeks_col = "Weeks" if "Weeks" in df.columns else "Week"

    records = []
    for _, row in df.iterrows():
        film = clean_str(row.get("Release"))
        if not film:
            continue
        records.append({
            "source_url": url,
            "film": film,
            "weekend_gross": clean_money(row.get(gross_col)),
            "theater_count": clean_int(row.get("Theaters")),
            "total_gross_to_date": clean_money(row.get("Total Gross")),
            "week_number_in_release": clean_int(row.get(weeks_col)),
            "distributor": clean_str(row.get("Distributor")),
        })

    # Extract year/week from URL pattern e.g. /weekend/2024W07/
    match = re.search(r"(\d{4})W(\d{2})", url)
    if match:
        year, week = match.groups()
        for r in records:
            r["year"] = int(year)
            r["week_of_year"] = int(week)

    return records


def scrape_bom_years(years):
    all_records = []
    for year in years:
        print(f"Fetching weekend list for {year}...")
        try:
            weekend_urls = get_weekend_urls_for_year(year)
        except Exception as e:
            print(f"  Failed to fetch year index for {year}: {e}")
            continue

        print(f"  Found {len(weekend_urls)} weekend pages")
        for url in weekend_urls:
            print(f"  Parsing {url}")
            try:
                records = parse_weekend_page(url)
                all_records.extend(records)
            except Exception as e:
                print(f"  Failed on {url}: {e}")
            time.sleep(SLEEP_SECONDS)
    return all_records


if __name__ == "__main__":
    YEARS = [2022, 2023, 2024]

    data = scrape_bom_years(YEARS)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(data)} records to {OUTPUT_PATH}")