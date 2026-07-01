"""
Fills missing genre and synopsis fields in numbers_release_schedule.json
by asking Claude about films that The Numbers didn't have data for.

Usage:
    python scraper/fill_gaps.py
"""

import json
import os
import re

import anthropic

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "numbers_release_schedule.json")

VALID_GENRES = {"Horror", "Action", "Animation", "Comedy", "Drama", "Sci-Fi", "Thriller", "Romance", "Documentary", "Musical", "Adventure"}

BATCH_SIZE = 50


def clean_title(film: str) -> str:
    return re.sub(r"\s*\((Wide|IMAX|Limited|Exclusive|Expanded|Select)\)\s*$", "", film, flags=re.IGNORECASE).strip()


def fill_gaps(data: list[dict], client: anthropic.Anthropic) -> list[dict]:
    # Deduplicate by canonical title — only query each unique film once
    canonical_to_indices: dict[str, list[int]] = {}
    for i, r in enumerate(data):
        title = clean_title(r["film"])
        canonical_to_indices.setdefault(title, []).append(i)

    # Only process films missing genre or synopsis
    missing = {
        title: indices
        for title, indices in canonical_to_indices.items()
        if not data[indices[0]].get("genre") or not data[indices[0]].get("synopsis")
    }

    titles = list(missing.keys())
    print(f"Filling gaps for {len(titles)} unique films...")

    results: dict[str, dict] = {}

    for batch_start in range(0, len(titles), BATCH_SIZE):
        batch = titles[batch_start: batch_start + BATCH_SIZE]
        print(f"  Batch {batch_start // BATCH_SIZE + 1}: {len(batch)} films")

        film_list = "\n".join(f"{i+1}. {t}" for i, t in enumerate(batch))

        prompt = f"""For each film below, provide the genre and a one-sentence synopsis.

Valid genres (pick exactly one): Horror, Action, Animation, Comedy, Drama, Sci-Fi, Thriller, Romance, Documentary, Musical, Adventure

If you don't know a film, use your best guess from the title. For very obscure films with no recognizable context, you may leave genre and synopsis as null.

Respond with a JSON array, one object per film, in the same order:
[{{"title": "...", "genre": "...", "synopsis": "..."}}, ...]

Films:
{film_list}"""

        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        text = resp.content[0].text.strip()
        # Extract JSON array from response
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            print("  Warning: could not parse response for this batch")
            continue

        try:
            parsed = json.loads(match.group())
        except json.JSONDecodeError:
            print("  Warning: JSON parse error for this batch")
            continue

        for i, item in enumerate(parsed):
            if i >= len(batch):
                break
            title = batch[i]
            genre = item.get("genre")
            synopsis = item.get("synopsis")
            if genre and genre not in VALID_GENRES:
                genre = None
            results[title] = {"genre": genre, "synopsis": synopsis}

    # Apply results back, only filling fields that are still empty
    for title, indices in missing.items():
        fill = results.get(title, {})
        for i in indices:
            r = data[i]
            if not r.get("genre") and fill.get("genre"):
                r["genre"] = fill["genre"]
            if not r.get("synopsis") and fill.get("synopsis"):
                r["synopsis"] = fill["synopsis"]

    return data


if __name__ == "__main__":
    with open(DATA_PATH) as f:
        data = json.load(f)

    before_genre = sum(1 for r in data if r.get("genre"))
    before_synopsis = sum(1 for r in data if r.get("synopsis"))

    client = anthropic.Anthropic()
    data = fill_gaps(data, client)

    after_genre = sum(1 for r in data if r.get("genre"))
    after_synopsis = sum(1 for r in data if r.get("synopsis"))

    print(f"\nGenre:    {before_genre} → {after_genre} / {len(data)}")
    print(f"Synopsis: {before_synopsis} → {after_synopsis} / {len(data)}")

    with open(DATA_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved to {DATA_PATH}")
