#!/usr/bin/env python3
"""Build dated 15x15 puzzle data from xfill's library output and Open English WordNet."""
import argparse
from datetime import date, timedelta
import json
from pathlib import Path
import re
import zipfile

WORDNET = 'https://en-word.net/downloads'
SIZE = 15
BUNDLED = Path(__file__).resolve().parents[1] / 'data/crossword/full-size.json'
LETTERS = re.compile(r'[A-Z]{3,15}')
CREDIT = 'sfjc.dev · Clues adapted from Open English WordNet (CC BY 4.0) and Princeton WordNet'


def read_definitions(archive_path):
    definitions = {}
    with zipfile.ZipFile(archive_path) as archive:
        for part in ('noun', 'verb', 'adj', 'adv'):
            path = next(name for name in archive.namelist() if name.endswith('/data.' + part))
            for raw in archive.read(path).decode('utf-8').splitlines():
                fields, divider, gloss = raw.partition(' | ')
                if not divider:
                    continue
                fields = fields.split()
                count = int(fields[3], 16)
                clue = gloss.split('; "')[0].strip()
                if not 8 <= len(clue) <= 160:
                    continue
                for lemma in fields[4:4 + count * 2:2]:
                    answer = re.sub(r"[_-]", '', lemma).upper()
                    # Skip clues which give away the entry as a full word or phrase.
                    words = re.findall(r'[a-zA-Z]+', clue.upper())
                    if LETTERS.fullmatch(answer) and not any(
                        answer == ''.join(words[start:end])
                        for start in range(len(words))
                        for end in range(start + 1, min(len(words), start + 4) + 1)
                    ):
                        definitions.setdefault(answer, clue[0].upper() + clue[1:])

    return definitions


def to_puzzle(grid, definitions, day):
    openings = [None if letter == '#' else letter for row in grid['fill'] for letter in row]
    if len(grid['fill']) != SIZE or any(len(row) != SIZE for row in grid['fill']):
        raise ValueError('Expected a 15×15 grid')
    clues = []
    coverage = {'Across': set(), 'Down': set()}
    answers = set()
    for entry in sorted(grid['entries'], key=lambda item: (item['dir'], item['num'])):
        answer = entry['answer']
        direction = {'A': 'Across', 'D': 'Down'}[entry['dir']]
        start = SIZE * entry['row'] + entry['col']
        step = 1 if direction == 'Across' else SIZE
        cells = [start + step * offset for offset in range(entry['len'])]
        if answer in answers or len(cells) < 3 or coverage[direction].intersection(cells):
            raise ValueError('Invalid or duplicate entry')
        if any(openings[cell] != character for cell, character in zip(cells, answer, strict=True)):
            raise ValueError('An entry disagrees with the grid')
        answers.add(answer)
        coverage[direction].update(cells)
        clues.append({
            'number': str(entry['num']),
            'direction': direction,
            'text': definitions[answer],
            'cells': cells,
        })
    expected = {i for i, cell in enumerate(openings) if cell}
    if any(covered != expected for covered in coverage.values()):
        raise ValueError('Every open square must cross two clues')
    return {
        'date': day.isoformat(), 'title': 'Daily Crossword', 'credit': CREDIT, 'creditUrl': WORDNET,
        'width': SIZE, 'height': SIZE, 'cells': openings, 'clues': clues,
    }


def bundled_editions():
    return json.loads(BUNDLED.read_text())


def write_template_bank(path):
    shapes = {}
    for puzzle in bundled_editions():
        rows = [
            ''.join('#' if cell is None else '.' for cell in puzzle['cells'][i:i + SIZE])
            for i in range(0, SIZE * SIZE, SIZE)
        ]
        shapes['/'.join(rows)] = None
    # Refill good shapes with different solver seeds.
    path.write_text(('\n'.join(shapes) + '\n') * 10)


def publish_editions(grids, definitions, directory):
    directory.mkdir(parents=True, exist_ok=True)
    schedule = bundled_editions() + [
        json.loads(path.read_text()) for path in sorted(directory.glob('????-??-??.json'))
    ]
    day = date.fromisoformat(schedule[-1]['date'])
    seen = {tuple(edition['cells']) for edition in schedule}
    added = 0
    for grid in grids:
        puzzle = to_puzzle(grid, definitions, day + timedelta(days=1))
        fingerprint = tuple(puzzle['cells'])
        if fingerprint in seen:
            continue
        edition = directory / (puzzle['date'] + '.json')
        with edition.open('x') as output:
            json.dump(puzzle, output, ensure_ascii=False, separators=(',', ':'))
            output.write('\n')
        day += timedelta(days=1)
        seen.add(fingerprint)
        added += 1
    if added == 0:
        raise ValueError('No distinct new puzzles')
    print(f'Published {added} editions through {day}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('wordnet', type=Path, help=f'WNDB archive from {WORDNET}')
    parser.add_argument('wordlist', type=Path, help='Crossword Nexus WORD;score list')
    parser.add_argument('filtered', type=Path, help='Output word list restricted to clueable entries')
    parser.add_argument('--library', type=Path, help='Generated xfill library JSON')
    parser.add_argument('--out', type=Path, help='Puzzle schedule to create or extend')
    parser.add_argument('--start', type=date.fromisoformat)
    parser.add_argument('--bank-output', type=Path, help='Write reusable grid templates derived from the bundled schedule')
    parser.add_argument('--published-dir', type=Path, help='Append individual dated editions to this directory')
    args = parser.parse_args()
    definitions = read_definitions(args.wordnet)
    filtered = [line for line in args.wordlist.read_text().splitlines() if line.split(';', 1)[0].upper() in definitions]
    args.filtered.write_text('\n'.join(filtered) + '\n')
    if args.bank_output:
        write_template_bank(args.bank_output)
    if not args.library:
        print(f'Prepared {len(filtered):,} clueable answers')
        return
    grids = json.loads(args.library.read_text())['grids']
    if args.published_dir:
        publish_editions(grids, definitions, args.published_dir)
        return
    if not args.out or not args.start:
        parser.error('--library requires --published-dir or both --out and --start')
    schedule = json.loads(args.out.read_text()) if args.out.exists() else []
    known = {tuple(puzzle['cells']) for puzzle in schedule}
    first = date.fromisoformat(schedule[0]['date']) if schedule else args.start
    if first != args.start:
        parser.error('Use the original --start when extending the puzzle schedule')
    added = 0
    for grid in grids:
        fingerprint = tuple(None if letter == '#' else letter for row in grid['fill'] for letter in row)
        if fingerprint in known:
            continue
        day = args.start + timedelta(days=len(schedule))
        schedule.append(to_puzzle(grid, definitions, day))
        known.add(fingerprint)
        added += 1
    if not added:
        parser.error('No new grids in the library')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text('[\n' + ',\n'.join(json.dumps(puzzle, ensure_ascii=False, separators=(',', ':')) for puzzle in schedule) + '\n]\n')
    print(f'Added {added} puzzles, through {schedule[-1]["date"]}')


if __name__ == '__main__':
    main()
