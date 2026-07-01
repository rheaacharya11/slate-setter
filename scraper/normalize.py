"""
Merges + normalizes raw BOM and Numbers scrape output into one clean dataset
for the backend/frontend to consume.

Usage:
    python scraper/normalize.py

Output:
    data/processed/normalized_weekend_data.json
    data/processed/normalized_weekend_data.csv
"""

import json
import os

import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed")

BOM_PATH = os.path.join(RAW_DIR, "bom_weekend_data.json")
NUMBERS_PATH = os.path.join(RAW_DIR, "numbers_release_schedule.json")

# Hardcoded marquee weekend lookup - cheap to do by hand, adjust week numbers
# to match the actual ISO/ BOM week numbering for each year you scrape.
MARQUEE_WEEKENDS = {
    (2022, 51): "Christmas",
    (2022, 7): "Valentine's Day",
    (2022, 26): "July 4th",
    (2022, 47): "Thanksgiving",
    (2023, 51): "Christmas",
    (2023, 6): "Valentine's Day",
    (2023, 26): "July 4th",
    (2023, 47): "Thanksgiving",
    (2024, 52): "Christmas",
    (2024, 6): "Valentine's Day",
    (2024, 27): "July 4th",
    (2024, 48): "Thanksgiving",
}


def load_bom_data():
    with open(BOM_PATH) as f:
        return pd.DataFrame(json.load(f))


def load_numbers_data():
    if not os.path.exists(NUMBERS_PATH):
        print(f"Warning: {NUMBERS_PATH} not found, skipping genre/distributor enrichment")
        return pd.DataFrame(columns=["film", "genre", "distributor", "date_label"])
    with open(NUMBERS_PATH) as f:
        return pd.DataFrame(json.load(f))


def normalize_title(title):
    """Lowercase + strip for fuzzy-ish joining between BOM and Numbers titles."""
    if not isinstance(title, str):
        return ""
    return title.lower().strip()


def main():
    bom_df = load_bom_data()
    numbers_df = load_numbers_data()

    if bom_df.empty:
        raise SystemExit(f"No BOM data found at {BOM_PATH} - run scrape_bom.py first")

    bom_df["film_key"] = bom_df["film"].apply(normalize_title)

    # Enrich with genre/distributor from Numbers where titles match
    if not numbers_df.empty:
        numbers_df["film_key"] = numbers_df["film"].apply(normalize_title)
        genre_lookup = (
            numbers_df.drop_duplicates("film_key")
            .set_index("film_key")[["genre"]]
        )
        bom_df = bom_df.join(genre_lookup, on="film_key", rsuffix="_numbers")
    else:
        bom_df["genre"] = None

    # Tag marquee weekends
    bom_df["marquee_weekend"] = bom_df.apply(
        lambda r: MARQUEE_WEEKENDS.get((r.get("year"), r.get("week_of_year"))),
        axis=1,
    )

    # Flag whether this row is a new wide release (week 1) vs a holdover
    bom_df["is_new_release"] = bom_df["week_number_in_release"] == 1

    # Drop helper column before saving
    bom_df = bom_df.drop(columns=["film_key"])

    os.makedirs(PROCESSED_DIR, exist_ok=True)
    json_path = os.path.join(PROCESSED_DIR, "normalized_weekend_data.json")
    csv_path = os.path.join(PROCESSED_DIR, "normalized_weekend_data.csv")

    bom_df.to_json(json_path, orient="records", indent=2)
    bom_df.to_csv(csv_path, index=False)

    print(f"Saved {len(bom_df)} records to:")
    print(f"  {json_path}")
    print(f"  {csv_path}")
    print()
    print("Preview:")
    print(bom_df.head(10).to_string())


if __name__ == "__main__":
    main()