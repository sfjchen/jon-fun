"""
Builds the Spelling Bee answer list and puzzle bank in public/spelling-bee/.

The answer list keeps common, lowercase English words that appear in both ENABLE (no proper nouns or abbreviations)
and SCOWL size 50, filtered by wordfreq Zipf frequency, without the letter S, with at least 4 letters and at most
7 distinct letters, minus an offensive-word blocklist. The puzzle bank keeps every (center, 6 outer letters) set
whose answer count and max score land in NYT-like ranges, skipping I+N+G
and E+D sets so -ING and -ED forms don't flood the answers. For a fair difficulty it also needs a common pangram,
a common median answer and at most 1 of J, Q, X, Z.

Usage: pip install wordfreq, then
  python3 scripts/build-spelling-bee.py <enable1.txt> <scowl final dir> <blocklist.txt>
Sources: github.com/dolph/dictionary enable1.txt, wordlist.aspell.net SCOWL 2020.12.07,
  github.com/LDNOOBW List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words (en).
"""
import glob
import json
import os
import statistics
import sys
from wordfreq import zipf_frequency

MIN_WORDS, MAX_WORDS, MAX_SCORE = 25, 55, 300
MIN_PANGRAM_ZIPF, MIN_MEDIAN_ZIPF = 3.0, 3.0
EXTRA_BLOCK = {'nigger', 'nigga', 'faggot', 'fagot', 'kike', 'chink', 'gook', 'wetback', 'raghead', 'tranny',
  'retard', 'retarded', 'coon', 'darky', 'dyke', 'honky', 'gyppo', 'gypped', 'injun', 'redneck', 'whore', 'hooker',
  'cunt', 'twat', 'prick', 'bitch', 'bitchy', 'boner', 'dildo', 'wank', 'wanker', 'jizz', 'porno', 'rape', 'raped',
  'rapine', 'raping', 'rapist', 'hitler', 'nazi', 'molest', 'pedophile', 'pederast', 'buggery', 'bugger'}


def scowl_words(fin, lv):
    """
    Reads every SCOWL english/american word file at or below size lv and returns its lowercase words.
    """
    out = set()
    for p in glob.glob(f'{fin}/english-words.*') + glob.glob(f'{fin}/american-words.*'):
        if int(p.rsplit('.', 1)[1]) <= lv:
            out |= {ln.strip() for ln in open(p, encoding='latin-1')}
    return out


def keep(w):
    """
    Reports whether w fits the base Spelling Bee shape: 4+ lowercase letters, no S, at most 7 distinct letters.
    """
    return len(w) >= 4 and w.isascii() and w.isalpha() and w.islower() and 's' not in w and len(set(w)) <= 7


def score(w):
    """
    Scores w the NYT way: 1 point for 4 letters, else 1 per letter, plus 7 for a pangram.
    """
    return (1 if len(w) == 4 else len(w)) + (7 if len(set(w)) == 7 else 0)


def main():
    """
    Builds words.txt and puzzles.json from the 3 source files given on the command line.
    """
    enable = {ln.strip() for ln in open(sys.argv[1])}
    block = {ln.strip().lower() for ln in open(sys.argv[3])} | EXTRA_BLOCK
    s50, s60 = scowl_words(sys.argv[2], 50), scowl_words(sys.argv[2], 60)
    words = sorted(w for w in enable if keep(w) and w not in block and
        not any(b in w for b in ('nigg', 'fagg', 'cunt')) and
        ((w in s50 and zipf_frequency(w, 'en') >= 1.5) or (w in s60 and zipf_frequency(w, 'en') >= 2.8)))

    masks = {}
    for w in words:
        masks.setdefault(frozenset(w), []).append(w)
    sets = {k for k in masks if len(k) == 7 and not set('ing') <= k and not set('ed') <= k and
        len(k & set('jqxz')) <= 1 and max(zipf_frequency(w, 'en') for w in masks[k]) >= MIN_PANGRAM_ZIPF}
    puzzles = []
    for st in sorted(sets, key=sorted):
        ls = sorted(st)
        subs = [(k, masks[k]) for k in (frozenset(ls[i] for i in range(7) if m >> i & 1) for m in range(1, 128))
          if k in masks]
        for c in sorted(st):
            ans = [w for k, v in subs if c in k for w in v]
            pts = sum(score(w) for w in ans)
            if (MIN_WORDS <= len(ans) <= MAX_WORDS and pts <= MAX_SCORE and
                statistics.median(zipf_frequency(w, 'en') for w in ans) >= MIN_MEDIAN_ZIPF):
                puzzles.append(c + ''.join(sorted(st - {c})))

    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'spelling-bee')
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, 'words.txt'), 'w') as f:
        f.write('\n'.join(words))
    with open(os.path.join(out, 'puzzles.json'), 'w') as f:
        json.dump(puzzles, f, separators=(',', ':'))
    print(f'{len(words)} words, {len(sets)} pangram sets, {len(puzzles)} puzzles')


main()
