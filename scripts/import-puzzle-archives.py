"""Fetch public historical snapshots and produce static, year-sharded puzzle archives.
Run: python3 scripts/import-puzzle-archives.py [--cache /tmp/puzzle-archives]
No NYT credentials or live puzzle endpoints are used.
"""
import argparse
import collections
import csv
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    'connections': 'https://huggingface.co/datasets/eric27n/NYT-Connections/resolve/main/Connections_Data.csv',
    'mini': 'https://codeload.github.com/timjkong/nyt-crossword-data/tar.gz/refs/heads/main',
}


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path('/tmp/puzzle-archives'))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    output = ROOT / 'public/puzzle-archives'
    manifest = {'schemaVersion': 1, 'sources': {}}
    for kind, url in SOURCES.items():
        cached = args.cache / ('connections.csv' if kind == 'connections' else 'mini.tar.gz')
        if not cached.exists():
            temporary = cached.with_suffix('.download')
            urllib.request.urlretrieve(url, temporary)
            temporary.replace(cached)
        puzzles = []
        if kind == 'connections':
            games = collections.defaultdict(list)
            for row in csv.DictReader(io.StringIO(cached.read_text(encoding='utf-8-sig'))):
                games[(row['Puzzle Date'], row['Game ID'])].append(row)
            for (date, number), rows in sorted(games.items()):
                groups = []
                for level, difficulty in enumerate(['yellow', 'green', 'blue', 'purple']):
                    members = [r for r in rows if int(r['Group Level']) == level]
                    assert len(members) == 4, (date, level)
                    assert len({r['Group Name'] for r in members}) == 1
                    groups.append({'category': members[0]['Group Name'], 'difficulty': difficulty,
                                   'words': [r['Word'] for r in members]})
                assert len({w.casefold() for g in groups for w in g['words']}) == 16, date
                slug = f'nyt-archive-{date}'
                puzzles.append({'id': slug, 'slug': slug, 'date': date, 'version': 1,
                    'title': f'NYT Connections #{number} · {date}',
                    'description': 'Historical puzzle via eric27n/NYT-Connections on Hugging Face.',
                    'tags': ['nyt', 'archive', date], 'groups': groups,
                    'authorDisplay': 'The New York Times', 'authorFingerprint': '',
                    'createdAt': date + 'T00:00:00Z', 'updatedAt': date + 'T00:00:00Z',
                    'startingWords': [r['Word'] for r in sorted(rows, key=lambda r: (int(r['Starting Row']), int(r['Starting Column'])))]})
        else:
            with tarfile.open(cached, 'r:gz') as archive:
                for member in archive:
                    if '/data/raw/mini/' not in member.name or not member.name.endswith('.json'):
                        continue
                    raw = json.load(archive.extractfile(member))
                    body = raw['body'][0]
                    width, height = body['dimensions']['width'], body['dimensions']['height']
                    cells = [c.get('answer') or None for c in body['cells']]
                    assert len(cells) == width * height
                    clues = []
                    for c in body['clues']:
                        indices = c['cells']
                        assert all(0 <= i < len(cells) and cells[i] for i in indices)
                        clues.append({'number': str(c['label']), 'direction': c['direction'],
                            'text': ' '.join(t.get('plain', '') for t in c['text']),
                            'cells': indices, 'answer': ''.join(cells[i] for i in indices)})
                    puzzles.append({'date': raw['publicationDate'], 'id': raw['id'],
                        'constructors': raw.get('constructors', []), 'editor': raw.get('editor', ''),
                        'copyright': raw.get('copyright', ''), 'width': width, 'height': height,
                        'cells': cells, 'clues': clues})
        puzzles.sort(key=lambda p: p['date'])
        assert puzzles and len({p['date'] for p in puzzles}) == len(puzzles)
        years = collections.defaultdict(list)
        words = set()
        for puzzle in puzzles:
            years[puzzle['date'][:4]].append(puzzle)
            words.update(w for g in puzzle.get('groups', []) for w in g['words'])
            words.update(c['answer'] for c in puzzle.get('clues', []))
        for year, batch in years.items():
            write(output / kind / f'{year}.json', batch)
        write(output / kind / 'index.json', [p['date'] for p in puzzles])
        write(output / kind / 'words.json', sorted(words))
        manifest['sources'][kind] = {'url': url, 'sha256': hashlib.sha256(cached.read_bytes()).hexdigest(),
            'puzzles': len(puzzles), 'uniqueWords': len(words), 'firstDate': puzzles[0]['date'],
            'lastDate': puzzles[-1]['date']}
    write(output / 'manifest.json', manifest)
    print(json.dumps(manifest, indent=2))


if __name__ == '__main__':
    main()
