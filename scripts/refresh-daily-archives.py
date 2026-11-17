"""Refresh historical banks and capture the current-day original Krillion answer review."""
import collections
import datetime
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/puzzle-archives'

def fetch(url):
    return json.loads(subprocess.check_output(['curl', '-fLs', '--retry', '2', '--max-time', '45', url]))

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')

def bank(kind, games):
    years = collections.defaultdict(list)
    for game in sorted(games, key=lambda g: g['date']):
        years[game['date'][:4]].append(game)
    for year, puzzles in years.items(): write(OUT / kind / (year + '.json'), puzzles)
    write(OUT / kind / 'index.json', sorted(g['date'] for g in games))

def metadata(kind, games, url):
    import hashlib
    path = OUT / 'manifest.json'
    data = json.loads(path.read_text()) if path.exists() else {'schemaVersion':1,'sources':{}}
    dates = sorted(g['date'] for g in games)
    words = {w for g in games for w in (g.get('answers',[]) or [w for group in g.get('groups',[]) for w in group['words']])}
    data['sources'][kind] = dict(url=url, puzzles=len(games), uniqueWords=len(words), firstDate=dates[0], lastDate=dates[-1], normalizedSha256=hashlib.sha256(json.dumps(games,ensure_ascii=False,sort_keys=True).encode()).hexdigest())
    write(path,data)

def connections():
    raw = fetch('https://raw.githubusercontent.com/Eyefyre/NYT-Connections-Answers/main/connections.json')
    games = []
    for row in raw:
        date = row['date']
        assert len(row['answers']) == 4
        known = sorted(g['level'] for g in row['answers']) == [0, 1, 2, 3]
        groups = sorted(row['answers'], key=lambda g: g['level']) if known else row['answers']
        assert all(len(g['members']) == 4 for g in groups)
        if len({w.casefold() for g in groups for w in g['members']}) != 16 or any(not w.strip() for g in groups for w in g['members']):
            print('Excluded unsupported image/empty-word puzzle:', date)
            continue
        slug = 'nyt-archive-' + date
        games.append(dict(id=slug, slug=slug, date=date, version=1,
            title=f"Connections · {date}", description='Historical Connections puzzle',
            groups=[dict(category=g['group'], difficulty=['yellow','green','blue','purple'][i], words=g['members']) for i,g in enumerate(groups)],
            difficultyKnown=known, tags=['archive', date], authorDisplay='The New York Times',
            authorFingerprint='', createdAt=date+'T00:00:00Z', updatedAt=date+'T00:00:00Z'))
    bank('connections', games)
    write(OUT / 'connections/words.json', sorted({w for g in games for group in g['groups'] for w in group['words']}))
    metadata('connections',games,'https://github.com/Eyefyre/NYT-Connections-Answers')
    print('Connections:', len(games))

def bee():
    # The checked snapshot is small enough to refresh as a single GitHub tarball.
    import tarfile, io
    data = subprocess.check_output(['curl','-fLs','--retry','2','--max-time','90','https://codeload.github.com/tedmiston/spelling-bee-answers/tar.gz/refs/heads/main'])
    games = []
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
        for member in tar:
            if '/days/' not in member.name or not member.name.endswith('.json'): continue
            r = json.load(tar.extractfile(member))
            letters = r['centerLetter'] + ''.join(r['outerLetters'])
            answers = sorted(set(w.lower() for w in r['answers']))
            assert len(set(letters)) == 7 and all(len(w) >= 4 and letters[0] in w and set(w) <= set(letters) for w in answers)
            games.append(dict(date=r['printDate'], id=letters, center=letters[0], outer=list(letters[1:]), answers=answers,
                pangrams=[w for w in answers if len(set(w)) == 7], max=sum((1 if len(w)==4 else len(w)) + (7 if len(set(w))==7 else 0) for w in answers)))
    bank('bee', games)
    write(OUT / 'bee/words.json', sorted({w for g in games for w in g['answers']}))
    metadata('bee',games,'https://github.com/tedmiston/spelling-bee-answers')
    print('Bee:', len(games))

def krillion():
    import gzip
    game = fetch('https://krillion.io/api/today')
    review = fetch('https://krillion.io/api/reveal?date=' + game['date'])
    assert review['date'] == game['date'] and len(review['prompts']) == 7
    for prompt in review['prompts']:
        assert prompt['answers'] and all(a['score'] in [10,15,30,60,85,100] for a in prompt['answers'])
    write(ROOT / 'data/krillion/prompts' / (game['date']+'.json'), game)
    target = ROOT / 'data/krillion/review' / (game['date']+'.json.gz')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(gzip.compress(json.dumps(review, ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
    print('Krillion original review captured:', game['date'], sum(len(p['answers']) for p in review['prompts']), 'answers')

if __name__ == '__main__':
    import sys
    tasks = {'connections': connections, 'bee': bee, 'krillion': krillion}
    for name in (sys.argv[1:] or tasks): tasks[name]()
