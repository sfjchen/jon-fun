#!/usr/bin/env python3
"""Capture Wordle's accepted guesses from its ordinary public client bundles."""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
def fetch(url):
    return subprocess.check_output(['curl', '-fLs', '--max-time', '25', url], text=True)

def words_in(url):
    source = fetch(url)
    for match in re.finditer(r'\[(?:"[a-z]{5}",){10000,}"[a-z]{5}"\]', source):
        words = json.loads(match.group())
        if len(words) == len(set(words)):
            return url, words
    return None

if __name__ == '__main__':
    page = fetch('https://www.nytimes.com/games/wordle/index.html')
    urls = [u for u in re.findall(r'<script[^>]+src="([^"]+)"', page) if '/games-assets/' in u]
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        lists = [result for result in pool.map(words_in, urls) if result]
    if len(lists) != 1:
        raise RuntimeError('Expected exactly one accepted guess list; no files changed')
    url, words = lists[0]
    content = json.dumps(words, separators=(',', ':')) + '\n'
    (ROOT / 'public/fivefold/words.json').write_text(content)
    provenance = {'source': url, 'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'count': len(words), 'sha256': hashlib.sha256(content.encode()).hexdigest()}
    (ROOT / 'public/fivefold/source.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(f'Captured {len(words)} official accepted guesses')
