"""
Scrapes The Numbers' movie release schedule for wide release dates / distributor info,
then enriches each film with details (genre, synopsis, runtime, budget) by fetching
each film's individual page on The Numbers.

The schedule page renders as a single table with columns:
  Release Date | Movie | Distributor | Domestic Box Office to Date

Release Date values:
  - "Month YYYY"  → month header rows (all 4 cols identical); set current year+month context
  - "Month D"     → specific date; year inferred from most-recent month header
  - NaN           → same date as previous row (forward-fill)
  - "Month TBD" / "Summer 2026" / "Fall 2026" etc. → fuzzy; no specific date

Usage:
    python scraper/scrape_numbers.py

Output:
    data/raw/numbers_release_schedule.json
"""

import json
import os
import re
import time
from datetime import datetime
from io import StringIO

import anthropic
import requests
import pandas as pd
from bs4 import BeautifulSoup

from utils import HEADERS, clean_str, clean_money

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "numbers_release_schedule.json")
BASE_URL = "https://www.the-numbers.com/movies/release-schedule"
MOVIE_BASE = "https://www.the-numbers.com/movie"

MONTH_NAMES = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

_MONTH_HEADER_RE = re.compile(
    r"^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$",
    re.IGNORECASE,
)
_SPECIFIC_DATE_RE = re.compile(
    r"^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})$",
    re.IGNORECASE,
)
_FORMAT_SUFFIX_RE = re.compile(r"\s*\((Wide|IMAX|Limited|Exclusive|Expanded|Select)\)\s*$", re.IGNORECASE)


def parse_numbers_release_schedule(url: str = BASE_URL) -> list[dict]:
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")

    tables = soup.find_all("table")
    if not tables:
        raise ValueError("No tables found on page")

    df = pd.read_html(StringIO(str(tables[0])))[0]
    df.columns = [str(c).strip() for c in df.columns]

    records = []
    current_year: int | None = None
    current_date: str | None = None

    for _, row in df.iterrows():
        raw_date = str(row.get("Release Date", "")).strip()
        film = clean_str(row.get("Movie"))
        distributor = clean_str(row.get("Distributor"))

        if raw_date and raw_date == clean_str(row.get("Movie")):
            m = _MONTH_HEADER_RE.match(raw_date)
            if m:
                current_year = int(m.group(2))
                current_date = None
            continue

        if not film:
            continue

        if raw_date and raw_date.lower() not in ("nan", ""):
            m = _SPECIFIC_DATE_RE.match(raw_date)
            if m and current_year is not None:
                month = MONTH_NAMES[m.group(1).lower()]
                day = int(m.group(2))
                try:
                    dt = datetime(current_year, month, day)
                    current_date = dt.strftime("%Y-%m-%d")
                except ValueError:
                    current_date = None
            else:
                current_date = None

        records.append({
            "release_date": current_date,
            "film": film,
            "distributor": distributor,
            "genre": None,
            "subgenre": None,
            "synopsis": None,
            "running_time": None,
            "production_budget": None,
        })

    return records


def title_to_slug_base(film: str) -> str:
    """Convert a film title to the slug prefix used by The Numbers (without year)."""
    title = _FORMAT_SUFFIX_RE.sub("", film).strip()
    slug = title.replace("&", "and")
    slug = re.sub(r"['''’]", "", slug)
    slug = re.sub(r"[^a-zA-Z0-9\s\-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    return slug


def search_numbers_slug(title: str) -> str | None:
    """
    Search The Numbers for a film title and return the first matching movie URL slug.
    Falls back to None if no match found.
    """
    search_url = f"https://www.the-numbers.com/search?searchterm={requests.utils.quote(title)}"
    try:
        resp = requests.get(search_url, headers=HEADERS, timeout=15)
    except Exception:
        return None

    soup = BeautifulSoup(resp.text, "lxml")
    title_lower = title.lower()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("/movie/"):
            continue
        # Match by anchor text (case-insensitive) rather than slug, since Numbers
        # reorders articles and strips special chars in unpredictable ways
        link_text = a.get_text(strip=True).lower()
        if link_text == title_lower:
            return href[len("/movie/"):]
    return None


def _parse_movie_page(soup: BeautifulSoup) -> dict:
    """Parse genre/subgenre/runtime/budget/synopsis from a Numbers movie page soup."""
    facts: dict[str, str] = {}
    for b in soup.find_all("b"):
        key = b.get_text(strip=True).rstrip(":")
        td = b.find_parent("td")
        if td:
            next_td = td.find_next_sibling("td")
            if next_td:
                facts[key] = next_td.get_text(strip=True)

    # Synopsis lives in an accordion: <h2>Synopsis</h2><p>...</p>
    synopsis = None
    for h2 in soup.find_all("h2"):
        if h2.get_text(strip=True) == "Synopsis":
            p = h2.find_next_sibling("p")
            if p:
                synopsis = p.get_text(strip=True)
            break

    budget_raw = facts.get("Production Budget", "")
    budget_clean = re.sub(r"\s*\(.*?\)\s*$", "", budget_raw)

    return {
        "genre": facts.get("Genre") or None,
        "subgenre": facts.get("Subgenre") or None,
        "synopsis": synopsis,
        "running_time": facts.get("Running Time") or None,
        "production_budget": clean_money(budget_clean) or None,
    }


def fetch_film_details(film: str, release_date: str | None) -> dict | None:
    """
    Fetch movie details from The Numbers. Tries the direct slug first (using
    release year), then tries adjacent years, then falls back to site search.
    Returns parsed detail dict or None if the film has no page.
    """
    slug_base = title_to_slug_base(film)
    if not slug_base:
        return None

    # Try release year ± 1 before hitting search
    year = None
    if release_date:
        try:
            year = datetime.strptime(release_date, "%Y-%m-%d").year
        except ValueError:
            pass

    # The Numbers moves leading articles to the end: "The Odyssey" → "Odyssey-The"
    article_match = re.match(r"^(The|A|An)-(.+)$", slug_base, re.IGNORECASE)
    article_variant = f"{article_match.group(2)}-{article_match.group(1)}" if article_match else None

    candidate_slugs = []
    if year:
        for base in filter(None, [slug_base, article_variant]):
            candidate_slugs += [f"{base}-({year})", f"{base}-({year - 1})", f"{base}-({year + 1})"]

    for slug in candidate_slugs:
        try:
            resp = requests.get(f"{MOVIE_BASE}/{slug}", headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                return _parse_movie_page(BeautifulSoup(resp.text, "lxml"))
        except Exception:
            continue

    # Fall back to search
    canonical_title = _FORMAT_SUFFIX_RE.sub("", film).strip()
    found_slug = search_numbers_slug(canonical_title)
    if found_slug:
        try:
            resp = requests.get(f"{MOVIE_BASE}/{found_slug}", headers=HEADERS, timeout=15)
            if resp.status_code == 200:
                return _parse_movie_page(BeautifulSoup(resp.text, "lxml"))
        except Exception:
            pass

    return None


def enrich_records(records: list[dict], delay: float = 0.4) -> list[dict]:
    """Fetch details once per unique canonical title, apply to all matching records."""
    # Map canonical title → (film, release_date) for one API call per unique film
    canonical_to_record: dict[str, tuple[str, str | None]] = {}
    for r in records:
        canonical = _FORMAT_SUFFIX_RE.sub("", r["film"]).strip()
        if canonical not in canonical_to_record:
            canonical_to_record[canonical] = (r["film"], r["release_date"])

    details_cache: dict[str, dict | None] = {}
    total = len(canonical_to_record)
    for i, (canonical, (film, release_date)) in enumerate(canonical_to_record.items(), 1):
        print(f"  [{i}/{total}] {canonical}", end="", flush=True)
        detail = fetch_film_details(film, release_date)
        details_cache[canonical] = detail
        print(f" → {detail['genre'] if detail else 'not found'}")
        time.sleep(delay)

    enriched = []
    for r in records:
        canonical = _FORMAT_SUFFIX_RE.sub("", r["film"]).strip()
        detail = details_cache.get(canonical)
        if detail:
            r = {**r, **detail}
        enriched.append(r)

    return enriched


if __name__ == "__main__":
    print(f"Fetching release schedule from {BASE_URL}...")
    data = parse_numbers_release_schedule()
    dated = [r for r in data if r["release_date"]]
    print(f"Parsed {len(data)} records ({len(dated)} with specific dates).")

    print(f"\nEnriching {len(data)} records via individual Numbers pages...")
    data = enrich_records(data)
    with_genre = sum(1 for r in data if r["genre"])
    print(f"\nEnrichment complete: {with_genre}/{len(data)} films have genre.")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(data)} records to {OUTPUT_PATH}")
