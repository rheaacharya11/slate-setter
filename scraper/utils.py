import pandas as pd

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def clean_money(val):
    """Convert a string like '$12,345,678' into an int. Returns None if unparseable."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    val = str(val).replace("$", "").replace(",", "").strip()
    if val in ("", "-", "nan", "None"):
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def clean_int(val):
    """Convert a string like '2,500' into an int. Returns None if unparseable."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    val = str(val).replace(",", "").strip()
    if val in ("", "-", "nan", "None"):
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def clean_str(val):
    """Trim and normalize a string field, returning None for empty/NaN."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    val = str(val).strip()
    return val if val else None