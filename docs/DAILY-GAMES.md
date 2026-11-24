# Daily games

Wordle (id `fivefold`), Mini, Connections, Spelling Bee (`bee`), Krillion and Anthropeum, plus a daily SET. Local playable versions of the originals, not embeds. Nothing is ever submitted to an upstream game.

## How a day works

- 1 calendar for everyone - the Pacific date (`siteDay` in `src/lib/daily.ts`). Originals that reset on Eastern time lag by a few hours.
- A game started before midnight keeps its puzzle and result date. A reload within 1 hour after midnight resumes it (`src/lib/play-day.ts`).
- `?d=YYYY-MM-DD` plays another day. `firstDay(game)` to `MAX_DAY` is the accepted range. Future days are unranked previews, and NYT games have none.
- Each game keeps its first finished result, on the device and on the server. A day already finished under the same name on another device opens on that saved result (`src/lib/daily/saved-run.ts`, `POST /api/results/run`). Spelling Bee is the exception - its score grows as words are found, and found words merge across a player's devices.
- Results save to a device queue first, then sync and retry (`src/lib/results.ts`). A 429 or 5xx stays queued, any other rejection is dropped.

## Code map

| Piece                                  | Where                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Game registry (title, url, max, rules) | `GAMES` in `src/lib/results.ts`                                                     |
| Dates, playable range, NYT first days  | `src/lib/daily.ts`                                                                  |
| Puzzle for a day                       | `GET /api/daily/[game]` → `dailyPuzzle` in `src/lib/daily/server.ts`                |
| NYT fetch, validation, snapshots       | `src/lib/daily/nyt.ts`, `nyt-puzzles.ts`                                            |
| Krillion and Anthropeum sources        | `src/lib/daily/krillion.ts`, `anthropeum.ts`                                        |
| Page shell for 5 games                 | `src/components/daily/DailyGame.tsx` (Spelling Bee has its own, for practice hives) |
| Score check                            | `POST /api/results` → `VERIFIERS` in `src/lib/daily/verify.ts`                      |
| Boards and stats                       | `/leaderboards` (`src/components/Scores.tsx`), Daily drawer (`DailyDrawer.tsx`)     |

Adding a daily game - add it to `GAMES`, give it a verifier (the build fails without one), a branch in `dailyPuzzle`, a player component and its route in `PageShell`.

## Puzzle sources

- NYT games load by exact publication date: bundled year archive (`public/puzzle-archives/<game>/<year>.json`), then the `daily_game_content` snapshot, then the NYT's public dated JSON. No login, no rotating list, no other-day fallback. A missing day shows an unavailable message.
- Archive coverage starts 2021-06-19 (Wordle), 2018-05-06 (Bee), 2014-08-21 (Mini), 2023-06-12 (Connections). `public/puzzle-archives/manifest.json` records counts, source URLs, hashes and unavailable days (Bee 2018-06-30 has a conflicting answer list and is left out).
- Wordle accepts the 14,855 words of the NYT client (`public/fivefold/words.json`, refreshed by `scripts/sync-wordle-words.py`).
- Krillion uses the original's same-date prompts and answer review (accepted answers, aliases, rarity scores). A day's review is bundled or fetched from the original on first request, then stored.
- Anthropeum uses the original's public artifacts and historical polygons, bundled per day in `data/anthropeum`.
- `/games/archives` browses all 4 NYT games by date and offers each year's puzzles and word lists.

## Cron (`vercel.json`)

- `/api/cron/daily` runs at 07, 08, 09, 10 and 11 UTC. Hobby crons fire anywhere inside their hour and are not retried, so the runs overlap: 07 and 08 cover Pacific midnight in both offsets, the rest recover late feeds. The handler skips unless the Pacific hour is 0-3, fetches all 6 puzzles for the day, and saves the previous day's Anthropeum player statistics.
- `/api/cron/krillion` runs in each hour from 00 to 04 UTC and saves the original's player curve for its open day on every run, as does `/api/cron/daily`. The curve cannot be fetched after the original's Eastern reset (04:00 or 05:00 UTC), so the last run before it leaves the saved one, and a day nobody played here still has a curve.
- `/api/poker/cleanup` removes rooms idle for 24 hours (poker, 24, party, Triples).
- Every cron route needs `CRON_SECRET` and rejects all calls when it is unset (`src/lib/api-guards.ts`).
- Requests also fetch on demand, so a late feed recovers without waiting for the next run.

## Rules and ranking

- Mini - active solve time, paused when you pause or leave. First unassisted time ranks, lower wins. Check, Reveal and Autocheck mark the solve as assisted.
- Connections - 4 groups, 4 mistakes, one-away hint, no repeat guesses. Solved puzzles rank by time. Unsolved ones rank below by groups found and never win the day. Mistakes do not break ties.
- Wordle - 6 tries, the original's marks and hard mode. The switch is a saved preference for every later puzzle, and a game picks it up only before its first guess. No clock. Ranked by guesses, a loss counts as 7 in averages, hard-mode results show `*`.
- Spelling Bee - the day's exact answer list, center letter required, 4-letter minimum, original points and rank thresholds.
- Krillion - 7 prompts, 25 seconds each on wall time, so a reload never grants a new clock. Wrong answers can be retried, and the draft is judged once at expiry. Answers are judged on the device from the prompt's answer key, with the server as fallback. Matching ignores accents, case, punctuation and a leading "the". From 5 letters, the closest answer within min(3, 0.28 × length) edits comes back as `"typed" → "answer"` and scores when sent again. Rarity scores are 10, 15, 30, 60, 85 or 100, maximum 700. No AI judging.
- Anthropeum - 10 artifacts, a map pin and a 250-year period each (125-year steps, 3000 BCE to 1750 CE). Up to 5,000 points for place (distance to the nearest polygon edge) and 5,000 for time, 100,000 overall. 3 free hints per game. The results page shows the original's score histogram and estimated placement.
- SET (`/games/set`) - a generated daily board of 12 cards with exactly 6 sets, not the original's board. Not on the leaderboard. `/games/triples` is the full 81-card game with PIN rooms, where each seat holds a private credential and claims use version checks.
- Boards - Daily, Standings and Your stats. Equal results share a rank. Rows stored under an older `SCORING_VERSION`, or with a source date that differs from their day, stay off the current boards.

## Verified scores

- Every result sends its moves (`stats.moves`). `/api/results` replays them against the day's puzzle and stores its own score, so a hand-made score cannot be posted.
- Wordle - guesses, word list, hard mode. Bee - found words. Connections - guesses and give-up. Anthropeum - pins and periods. Krillion - each round's accepted answer, judged again. Mini - the solved grid.
- Solve times (Mini, Connections) and Krillion's round clock cannot be replayed and stay as sent. Mini and Connections times under a floor no person can reach (0.15 s per Mini cell, 1 s per Connections guess) are rejected.
- Checked moves are kept in a `moves` column that score reads never return, so boards never reveal answers. Only `/api/results/run` reads it, to rebuild a player's finished game. Results saved before 2026-11-21 have no moves and show their score only, until the device that played them opens the day again.

## Players

- Games share the device ID of Daily Log and Notes ([SYNC.md](SYNC.md)). The name is stored locally and on the server, and comes back with the device cookie if local storage is cleared.
- A device playing as `Jon` is an admin of its board: Standings shows rename and remove beside each name (`POST /api/sync/players`, which checks the device's saved name from the sync cookie). A rename moves results and nudge subscriptions, and the renamed player's devices adopt the new name on their next visit (`sync_devices.player_was`). A remove deletes the player's results on that board.
- Friend nudges are web push (`src/lib/push.ts`, `/api/push/*`, handler in `public/e-reader-sw.js`). A subscription is 1 browser filed under a board name, and a nudge goes to every subscription under the friend's name, so all their devices get it. A browser that turns nudges on gets 1 confirming notification. iPhones need the site on the Home Screen. A desktop browser must be running (no tab needed), and a closed one gets the nudge when it next starts, within 12 hours.
- Names are unique per board regardless of case, backed by a unique index on the lowercased name. Editing a name does not rewrite earlier results.

## Scripts and tests

- `python3 scripts/sync-nyt-archives.py --through YYYY-MM-DD` resumes the archive download. `--verify-existing` rechecks saved days.
- `python3 scripts/refresh-daily-archives.py krillion` saves the current Krillion review into `data/krillion/review`. `npx tsx scripts/capture-krillion-review.ts` saves it to the database.
- `npx tsx scripts/verify-nyt-daily.ts [day]` checks that all 4 NYT games return that exact day.
- `npm test` runs `tests/*.test.ts` (NYT validation, original mechanics, ranking, SET). `e2e/daily-games.spec.ts` plays each game through to score delivery.
- `scripts/build-basemap.py` rebuilds the Anthropeum map tiles in `public/maps/basemap`.
