"""Import fully clued, public-domain 1924 Simon & Schuster grids from the XD corpus."""
import argparse
from datetime import date
import json
from pathlib import Path
import re
import zipfile


RECORD = re.compile(r'gxd/simonschuster/1924/ssb-(\d{2})\.xd')
CLUE = re.compile(r'([AD])(\d+)\. (.+) ~ ([A-Z]+)')
CREDIT = 'Simon & Schuster · The Cross Word Puzzle Book (1924)'
SOURCE = 'https://www.loc.gov/books/?q=Cross+Word+Puzzle+Book+1924'
CORPUS = 'https://xd.saul.pw/data'


def slots(rows, direction):
    """Enumerate entries in printed clue order, including two-letter entries."""
    height, width = len(rows), len(rows[0])
    for row, line in enumerate(rows):
        for col, letter in enumerate(line):
            if letter == '#':
                continue
            if direction == 'A':
                if col and line[col - 1] != '#':
                    continue
                answer = line[col:].split('#')[0]
                cells = [row * width + col + i for i in range(len(answer))]
            else:
                if row and rows[row - 1][col] != '#':
                    continue
                answer = ''.join(line[col] for line in rows[row:height]).split('#')[0]
                cells = [(row + i) * width + col for i in range(len(answer))]
            if len(answer) > 1:
                yield answer, cells


def parse(raw, edition):
    """Confirm the published clues match the digitized solution before converting the grid."""
    metadata, grid, *entry_blocks = re.split(r'\n{2,}', raw.strip())
    entries = '\n'.join(block for block in entry_blocks if re.match(r'[AD]\d+\. ', block))
    fields = dict(line.split(': ', 1) for line in metadata.splitlines() if ': ' in line)
    day = date.fromisoformat(fields['Date'])
    if day.year != 1924 or int(fields['Number']) != edition:
        raise ValueError('Unexpected publisher edition or publication date')
    rows = grid.splitlines()
    width, height = len(rows[0]), len(rows)
    if not (15 <= width <= 25 and 15 <= height <= 25):
        raise ValueError('Not a full-size grid supported by the shared player')
    if any(len(row) != width or not re.fullmatch(r'[A-Z#]+', row) for row in rows):
        raise ValueError('Missing or unsupported solution squares')
    clues = {'A': [], 'D': []}
    for line in entries.splitlines():
        match = CLUE.fullmatch(line)
        if not match:
            raise ValueError('Unexpected XD clue syntax')
        direction, number, text, answer = match.groups()
        clues[direction].append((int(number), text, answer))
    result = []
    covered = set()
    starts = {}
    for axis, direction in [('A', 'Across'), ('D', 'Down')]:
        for (number, text, answer), (grid_answer, cells) in zip(sorted(clues[axis]), slots(rows, axis), strict=True):
            if answer != grid_answer or starts.setdefault(cells[0], number) != number:
                raise ValueError('Clue order or answer does not agree with the grid')
            covered.update(cells)
            result.append({'number': str(number), 'direction': direction, 'text': text, 'cells': cells})
    cells = [None if char == '#' else char for row in rows for char in row]
    if covered != {i for i, value in enumerate(cells) if value}:
        raise ValueError('The original has open squares without a clue')
    return {
        'editionId': f'ssb-{edition:02}',
        'date': day.isoformat(),
        'title': fields['Title'],
        'credit': f"{fields['Author']} · {CREDIT}",
        'creditUrl': SOURCE,
        'transcriptionSource': CORPUS,
        'width': width,
        'height': height,
        'cells': cells,
        'clues': result,
    }


def main():
    """Writes the validated local catalog and reports editions that need manual review."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xd_zip', type=Path)
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / '.publisher-editions/classic-crossword/catalog.json'
    valid, excluded = [], {}
    with zipfile.ZipFile(args.xd_zip) as archive:
        for name in sorted(archive.namelist()):
            match = RECORD.fullmatch(name)
            if not match:
                continue
            try:
                valid.append(parse(archive.read(name).decode('utf-8-sig'), int(match[1])))
            except (UnicodeError, ValueError, KeyError) as error:
                excluded[match[1]] = str(error)
    if not valid:
        parser.error('No supported editions found')
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as file:
        json.dump({'puzzles': valid, 'excluded': excluded}, file, ensure_ascii=False, indent=2)
        file.write('\n')
    print(f'Archived {len(valid)} verified grids; {len(excluded)} excluded or need review.')


if __name__ == '__main__':
    main()
