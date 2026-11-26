"""Save a published Chainle edition for local replay, retaining original round order."""
from concurrent.futures import ThreadPoolExecutor
import argparse
import datetime
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from subprocess import check_output


def fetch(url):
    return json.loads(check_output(["curl", "-fsSL", "--retry", "2", "--max-time", "20", url]))


def pull(day):
    url = f"https://chainle.io/api/archive?date={day}"
    edition = fetch(url)
    if edition.get("date") != day:
        raise ValueError("Chainle returned a different edition")
    rounds = edition["pairs"]
    if [len(pair["anchors"]) for pair in rounds] != [2, 2, 2, 3, 1]:
        raise ValueError("Unexpected Chainle round layout")
    for pair in rounds:
        if not pair["answers"] or not all(isinstance(word, str) and word for word in pair["anchors"]):
            raise ValueError("Missing clues or answers")
        for answer in pair["answers"] + pair.get("accepted", []):
            if not isinstance(answer["word"], str) or type(answer["points"]) is not int or not 0 <= answer["points"] <= 1000:
                raise ValueError("Invalid scored answer")
    destination = Path(__file__).resolve().parents[1] / "data" / "chainle" / f"{day}.json"
    destination.parent.mkdir(exist_ok=True)
    with NamedTemporaryFile("w", dir=destination.parent, delete=False) as output:
        json.dump({key: edition[key] for key in ("date", "pairs")}, output, indent=2)
        output.write("\n")
    os.replace(output.name, destination)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("day", nargs="?", type=datetime.date.fromisoformat)
    selection.add_argument("--archive", action="store_true")
    args = parser.parse_args()
    if args.archive:
        archive = fetch("https://chainle.io/api/archive")
        days = sorted({datetime.date.fromisoformat(row["date"]).isoformat() for row in archive["entries"]})
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(pull, days))
    else:
        pull(args.day.isoformat())
