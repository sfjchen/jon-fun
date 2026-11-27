# Daily games

Wordle (id `fivefold`), Mini, Connections, Spelling Bee (`bee`), Krillion, Anthropeum and Orbs, plus a daily SET. Local playable versions of the originals, not embeds. Nothing is ever submitted to an upstream game.

## How a day works

- 1 calendar for everyone - the Pacific date (`siteDay` in `src/lib/daily.ts`). Originals that reset on Eastern time lag by a few hours.
- A game started before midnight keeps its puzzle and result date. A reload within 1 hour after midnight resumes it (`src/lib/play-day.ts`).
- `?d=YYYY-MM-DD` plays another day. `firstDay(game)` to `MAX_DAY` is the accepted range. Future days are unranked previews, and NYT games have none.
- Each game keeps its first finished result, on the device and on the server. A day already finished under the same name on another device opens on that saved result (`src/lib/daily/saved-run.ts`, `POST /api/results/run`). Spelling Bee is the exception - its score grows as words are found, and found words merge across a player's devices.
- Results save to a device queue first, then sync and retry (`src/lib/results.ts`). A 429 or 5xx stays queued, any other rejection is dropped.

## Code map

| Piece                                         | Where                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Game registry (title, url, max, rules, order) | `GAMES` in `src/lib/results.ts`                                                     |
| Dates, playable range, NYT first days         | `src/lib/daily.ts`                                                                  |
| Puzzle for a day                              | `GET /api/daily/[game]` → `dailyPuzzle` in `src/lib/daily/server.ts`                |
| NYT fetch, validation, snapshots              | `src/lib/daily/nyt.ts`, `nyt-puzzles.ts`                                            |
| Krillion and Anthropeum sources               | `src/lib/daily/krillion.ts`, `anthropeum.ts`                                        |
| Orbs bank and archive index                   | `data/orbs/<year>.json`, `public/orbs/categories.json`                              |
| Page shell for 6 games                        | `src/components/daily/DailyGame.tsx` (Spelling Bee has its own, for practice hives) |
| Score check                                   | `POST /api/results` → `VERIFIERS` in `src/lib/daily/verify.ts`                      |
| Boards and stats                              | `/leaderboards` (`src/components/Scores.tsx`), Daily drawer (`DailyDrawer.tsx`)     |

Adding or changing a game - follow [GAME-PLAYBOOK.md](GAME-PLAYBOOK.md): the steps, the keyboard formula, and the look, score and collaboration rules every game shares.

## Puzzle sources

- NYT games load by exact publication date: bundled year archive (`public/puzzle-archives/<game>/<year>.json`), then the `daily_game_content` snapshot, then the NYT's public dated JSON. No login, no rotating list, no other-day fallback. A missing day shows an unavailable message.
- Archive coverage starts 2021-06-19 (Wordle), 2018-05-06 (Bee), 2014-08-21 (Mini), 2023-06-12 (Connections). `public/puzzle-archives/manifest.json` records counts, source URLs, hashes and unavailable days (Bee 2018-06-30 has a conflicting answer list and is left out).
- Wordle accepts the 14,855 words of the NYT client (`public/fivefold/words.json`, refreshed by `scripts/sync-wordle-words.py`).
- Krillion uses the original's same-date prompts and answer review (accepted answers, aliases, rarity scores). A day's review is bundled or fetched from the original on first request, then stored.
- Anthropeum uses the original's public artifacts and historical polygons, bundled per day in `data/anthropeum`.
- Beginning 2026-12-07, a date without an authored Orbs edition combines four local archive rounds on a fixed schedule. This also works when a year file is absent. Keep the ten source boards (2026-11-27 through 2026-12-06) stable and schedule overrides before a day opens so ranked replays stay valid.
- The server also reads the approved Daily Orbs feed by exact date through `/api/orbs/publisher?d=YYYY-MM-DD`. It retains the first full published payload in `daily_game_content` under `publisher-orbs`, including the original date on publisher-designated repeat days. Later reads reuse that snapshot. The public route reports edition metadata, and ranked sfjc.dev Orbs uses its own bank.
- The publisher’s separate archive starts 2026-04-17. The date picker opens the original edition. `python3 scripts/sync-orbs-publisher.py DIRECTORY` saves the native puzzle records for offline use and resumes by skipping existing snapshots. Chainle’s historical editions can be refreshed with `python3 scripts/sync-chainle.py --archive`.
- Orbs reads original questions from `data/orbs/<year>.json`, starting 2026-11-21. After adding a day, regenerate the date-only archive index with `npx tsx scripts/build-orbs-index.ts`. Use `--check` to verify the index after editing the bank.
- `/games/orbs/archive` groups past Orbs rounds by category through yesterday. A date can also open its full four-puzzle edition with the same title, clues, option order and player as its daily route. Archive progress is per date, category and browser. Daily marks come from ranked scores or completed local daily runs.
- `/games/archives` browses all 4 NYT games by date and offers each year's puzzles and word lists.

## Cron (`vercel.json`)

- `/api/cron/daily` runs at 07, 08, 09, 10 and 11 UTC. Hobby crons fire anywhere inside their hour and are not retried, so the runs overlap: 07 and 08 cover Pacific midnight in both offsets, the rest recover late feeds. The handler skips unless the Pacific hour is 0-3, fetches all registered puzzles and the publisher’s Daily Orbs edition for the day, and saves the previous day's Anthropeum player statistics.
- `/api/cron/krillion` runs in each hour from 00 to 04 UTC and saves the original's player curve for its open day on every run, as does `/api/cron/daily`. The curve cannot be fetched after the original's Eastern reset (04:00 or 05:00 UTC), so the last run before it leaves the saved one, and a day nobody played here still has a curve.
- `/api/poker/cleanup` removes rooms idle for 24 hours (poker, 24, party, Triples).
- Every cron route needs `CRON_SECRET` and rejects all calls when it is unset (`src/lib/api-guards.ts`).
- Requests also fetch on demand, so a late feed recovers without waiting for the next run.

## Rules and ranking

- Mini - active solve time, paused when you pause or leave. First unassisted time ranks, lower wins. Autocheck ranks. Check and Reveal mark the solve as assisted. Runs finished before 2026-11-24 did not record which help was used, so a finished assisted one counts as an Autocheck solve and is sent once from the device that holds it (`sendAutocheckedMinis`).
- Connections - 4 groups, 4 mistakes, one-away hint, no repeat guesses. Solved puzzles rank by time. Unsolved ones rank below by groups found and never win the day. Mistakes do not break ties.
- Wordle - 6 tries, the original's marks and hard mode. The switch is a saved preference for every later puzzle, and a game picks it up only before its first guess. No clock. Ranked by guesses, a loss counts as 7 in averages, hard-mode results show `*`.
- Spelling Bee - the day's exact answer list, center letter required, 4-letter minimum, original points and rank thresholds. Found words are shared across the board (see Collaborative games).
- Krillion - 7 prompts, 25 seconds each on wall time, so a reload never grants a new clock. Wrong answers can be retried, and the draft is judged once at expiry. Answers are judged on the device from the prompt's answer key, with the server as fallback. Matching ignores accents, case, punctuation and a leading "the". From 5 letters, the closest answer within min(3, 0.28 × length) edits comes back as `"typed" → "answer"` and scores when sent again. Rarity scores are 10, 15, 30, 60, 85 or 100, maximum 700. No AI judging.
- Anthropeum - 10 artifacts, a map pin and a 250-year period each (125-year steps, 3000 BCE to 1750 CE). Up to 5,000 points for place (distance to the nearest polygon edge) and 5,000 for time, 100,000 overall. 3 free hints per game. The results page shows the original's score histogram and estimated placement.
- Orbs - Four themed puzzles open on separate screens. Formats include written clues, two-tap matching, sorting and a short quiz. Each puzzle has three lives, and a puzzle ends when every clue is solved or the lives run out. The first complete daily ranks with one orb per correct clue, up to 12. An archive round saves only its own mark.
- SET (`/games/set`) - a generated daily board of 12 cards with exactly 6 sets, not the original's board. Not on the leaderboard. `/games/triples` is the full 81-card game with PIN rooms, where each seat holds a private credential and claims use version checks.
- All 8 games (`GAME_IDS`) count the same toward overall wins, streaks, Daily drawer progress and nudges, and all show at once in the drawer and score grids.
- Crossword - the full-size daily counts as solved for every player in a room once its grid is correct. The result carries the room and the player's seat, and the server checks both against the day's puzzle. Mini-edition rooms do not count.
- Boards - 1 page: the day's score grid (its game icons filter to 1 game), standings by wins, and Your stats. Equal results share a rank. Rows stored under an older `SCORING_VERSION`, or with a source date that differs from their day, stay off the current boards.

## Verified scores

- Every result sends its moves (`stats.moves`). `/api/results` replays them against the day's puzzle and stores its own score, so a hand-made score cannot be posted.
- Wordle - guesses, word list, hard mode. Bee - found words. Connections - guesses and give-up. Anthropeum - pins and periods. Krillion - each round's accepted answer, judged again. Mini - the solved grid. Orbs - per-puzzle attempts and life limits. Earlier runs replay their 12 option indices.
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

## Collaborative games

Collaborative games are shared with everyone on a player's board, with no room to create or invite to send.

- Spelling Bee - a named player's daily found list is the whole board's: `/api/spelling-bee/words` merges every
  player's saved words for the day and the page pulls them on load and every 15 seconds. A player's result is saved
  once they add a word of their own, and then carries the shared list.
- Crossword - `/games/crossword` opens the board's 1 shared grid for the day (a room whose id is derived from the
  board code, game, day and edition). Every visitor lands in it, and one with no name yet sits in as a guest. The roster
  counts each player's words: a word goes to the first player to fill its last open square, right or wrong.
  **Change puzzle** leads to the date and edition picker, and **Play together** on
  the Mini opens the board's shared Mini grid.

Each room keeps a snapshot of its puzzle and saves shared progress in Supabase. The same tab can resume the room
after a reload, including edits waiting to sync. An invite link opens the same room for someone on another board.
A browser that rejoins from new tabs counts as 1 of the
100 players and keeps its 3 newest seats. The daily cron deletes rooms left untouched for 30 days.

Crossword Together opens the original 15×15 daily by default. It uses the bundled schedule through
March 9, 2027. Later editions are stored by date on the `crossword-schedule` branch. GitHub
Actions generates seven more boards every week and runs a larger batch when fewer than 45 days
remain. A manual run with `force` enabled generates a larger batch on demand. If the generated edition is unavailable, the site publishes an encore
from the bundled archive. Supabase pins the first board for a date so the daily and its archive
stay identical, including on an encore day. The date picker can reopen older editions. **Switch to
Mini** and invitations started on the Mini page use the existing NYT Mini source.

The [Open English WordNet](https://en-word.net/downloads) glossary supplies the clues under
CC BY 4.0. The grids use the MIT-licensed [xfill engine](https://github.com/ekorbia/xword-pipeline)
and [Crossword Nexus wordlist](https://github.com/Crossword-Nexus/collaborative-word-list).
To extend the dated schedule, use the WNDB download of Open English WordNet 2025+ and the
engine's `fill-engine/data/xwordlist.dict`. Run `scripts/build-full-crosswords.py` once to prepare
a WordNet-matched wordlist, fill new grids with xfill's `library --wordlist` option, then rerun the
script with `--library LIBRARY --published-dir PATH_TO_SCHEDULE_BRANCH/editions`. Use a different
xfill seed for each batch. The script appends independently dated files and checks for repeated grids.

An authorized provider can be configured with the server-only `CROSSWORD_DAILY_FEED_URL`, an
optional `CROSSWORD_DAILY_FEED_TOKEN` bearer token, and `CROSSWORD_DAILY_FEED_FIRST_DAY` for its
earliest date. The request includes a `date=YYYY-MM-DD` query parameter. The response is a JSON
object with `date`, `title`, `credit`, `width`, `height`, `cells`, and `clues`, plus an optional
HTTPS `creditUrl`. List solution cells in row-major order with `null` for blocks. Each clue has a
string `number`, an `Across` or `Down` `direction`, plain `text`, and zero-based `cells`. The daily
cron syncs the configured feed, and saves the first validated response for each date in
`daily_game_content`.

Headcount opens at `/games/headcount`. The local archive starts with party 37 on 2026-11-26. The daily cron reads the public party feed and stores the first snapshot matching the requested party date. Five guesses replay against that snapshot for a score out of 100. Split and pie use percentage error, ranking and underdog allow two-point crowd ties, and the typical answer uses the ratio to the published median. Publisher guestbook submissions and live publisher standings are separate from the sfjc.dev board.
