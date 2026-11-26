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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('wordnet', type=Path, help=f'WNDB archive from {WORDNET}')
    parser.add_argument('wordlist', type=Path, help='Crossword Nexus WORD;score list')
    parser.add_argument('filtered', type=Path, help='Output word list restricted to clueable entries')
    parser.add_argument('--library', type=Path, help='Generated xfill library JSON')
    parser.add_argument('--out', type=Path, help='Puzzle schedule to create or extend')
    parser.add_argument('--start', type=date.fromisoformat)
    args = parser.parse_args()
    definitions = read_definitions(args.wordnet)
    filtered = [line for line in args.wordlist.read_text().splitlines() if line.split(';', 1)[0].upper() in definitions]
    args.filtered.write_text('\n'.join(filtered) + '\n')
    if not args.library:
        print(f'Prepared {len(filtered):,} clueable answers')
        return
    if not args.out or not args.start:
        parser.error('--library requires --out and --start')

    grids = json.loads(args.library.read_text())['grids']
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
