# Historical puzzle archives

Browse `/games/archives`, linked from the Connections library. Connections opens in the existing player without Supabase. Mini supports typing into the grid, selecting clues, keyboard navigation, checking answers, revealing and resetting. Download links expose each year's normalized games and the distinct answer/word lists.

## Included snapshots

| Game | Puzzles | Dates | Distinct words/answers | Source |
| --- | ---: | --- | ---: | --- |
| Connections | 628 | 2023-06-12 to 2025-02-28 | 5,296 | [eric27n/NYT-Connections](https://huggingface.co/datasets/eric27n/NYT-Connections) |
| Mini | 3,737 | 2014-08-21 to 2024-11-12 | 12,490 | [timjkong/nyt-crossword-data](https://github.com/timjkong/nyt-crossword-data) |

These are source snapshots, not complete archives through today. Connections has gaps in its source dates. Mini includes the full grids, clue-to-cell mappings, clues, solutions, constructors, editor and copyright metadata. Connections preserves categories, difficulty colors, words, puzzle numbers, dates and original starting word order (the existing player shuffles on play). Historical puzzles do not send play statistics to the community database.

## Reproduce or refresh

Run `python3 scripts/import-puzzle-archives.py`. Python's standard library is sufficient. Downloads are cached in `/tmp/puzzle-archives`; pass `--cache PATH` to use another cache directory. To fetch newer source versions, remove the cached downloads first. The importer validates group sizes, tiers, unique words, unique puzzle dates, grid sizes and clue cell references before writing. Generated JSON is sharded by year to avoid downloading the whole archive for one puzzle.

`public/puzzle-archives/manifest.json` records source URLs, exact downloaded SHA-256 hashes, date coverage and counts. Reproducing exactly requires retaining the source downloads matching those hashes, because upstream URLs can change. No NYT credentials or live NYT endpoints are used. This is a manual snapshot importer; no recurring job is installed.
