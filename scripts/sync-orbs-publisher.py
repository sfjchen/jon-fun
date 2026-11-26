"""Download published Daily Orbs editions without converting their native puzzle formats."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
import json
import os
from pathlib import Path
from subprocess import check_output
from tempfile import NamedTemporaryFile

API = "https://api.dailyorbs.com/api/game-day"


def fetch(url):
    return json.loads(check_output(["curl", "-fsSL", "--retry", "2", "--max-time", "25", url]))


def save(day, directory):
    destination = directory / f"{day}.json"
    if destination.exists():
        return
    edition = fetch(f"{API}?date={day}")
    if edition.get("dateKey") != day or edition.get("state") not in ("ready", "deja-vu") or not edition.get("puzzles"):
        raise ValueError(f"No published edition for {day}")
    snapshot = {key: edition[key] for key in ("dateKey", "state", "originalDate", "puzzles") if key in edition}
    with NamedTemporaryFile("w", dir=directory, delete=False) as output:
        json.dump(snapshot, output, ensure_ascii=False, separators=(",", ":"))
        output.write("\n")
    os.replace(output.name, destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--start", type=date.fromisoformat)
    parser.add_argument("--end", type=date.fromisoformat)
    args = parser.parse_args()
    current = fetch(API)
    start = args.start or date.fromisoformat(current["archiveStartKey"])
    end = args.end or date.fromisoformat(current["todayKey"])
    if start > end:
        parser.error("start must be on or before end")
    args.directory.mkdir(parents=True, exist_ok=True)
    days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda day: save(day, args.directory), days))
