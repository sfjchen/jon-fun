# Daily games

Local playable versions of the originals, not embeds. Nothing is ever submitted to an upstream game. Adding or changing a game follows [GAME-PLAYBOOK.md](GAME-PLAYBOOK.md).

## Games at a glance

The first 6 rows of the registry (Connections, Wordle, Mini, Spelling Bee, Krillion, Anthropeum) are the Daily shelf (`DAILY_IDS`). Every other game is on the Beta shelf (`BETA_IDS`), opened by the Beta button beside Daily or the drawer's Beta tab, with its own boards at `/leaderboards?shelf=beta`.

| Game (id)            | Source                            | First day  | Score         | Ranks by                | Shared with the board |
| -------------------- | --------------------------------- | ---------- | ------------- | ----------------------- | --------------------- |
| Connections          | NYT, exact date                   | 2023-06-12 | groups of 4   | solve time, then groups | no                    |
| Wordle (`fivefold`)  | NYT, exact date                   | 2021-06-19 | guesses of 6  | fewest guesses          | no                    |
| Mini                 | NYT, exact date                   | 2014-08-21 | solve time    | lowest unassisted time  | no                    |
| Spelling Bee (`bee`) | NYT, exact date                   | 2018-05-06 | points        | most points             | found words           |
| Crossword            | generated here (xfill, WordNet)   | 2026-11-20 | solved, words | shared solve            | the whole grid        |
| Kabloom              | kabloom.io, local dated export    | 2026-11-01 | rounds of 7   | most rounds             | no                    |
| Headcount            | headcountgame.com, dated party    | 2026-11-26 | of 100        | most points             | no                    |
| Chainle              | chainle.io, dated edition         | 2026-08-20 | of 5,000      | most points             | no                    |
| Orbs                 | dailyorbs.com, dated edition      | 2026-11-26 | of 12 orbs    | most orbs               | no                    |
| Krillion             | the original's same-date prompts  | 2026-11-01 | of 700        | most points             | no                    |
| Anthropeum           | the original's artifacts, per day | 2026-11-01 | of 100,000    | most points             | no                    |
| Outline              | made here, Natural Earth data     | 2026-11-01 | guesses of 6  | fewest guesses          | no                    |
| Border hop (`hop`)   | made here, Natural Earth data     | 2026-11-01 | of 100        | most points             | no                    |
| Pin drop (`pin`)     | made here, Natural Earth data     | 2026-11-01 | of 5,000      | most points             | no                    |
| Ballpark             | made here, Natural Earth data     | 2026-11-01 | of 300        | most points             | no                    |

Every ranked game plays its publisher's puzzle except the Crossword, which has no publisher feed yet. Also here but off the boards - a daily SET (`/games/set`), and practice rounds from the sfjc.dev Orbs bank (`/games/orbs/archive`).

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

## Puzzle sources

- NYT games load by exact publication date: bundled year archive (`public/puzzle-archives/<game>/<year>.json`), then the `daily_game_content` snapshot, then the NYT's public dated JSON. No login, no rotating list, no other-day fallback. A missing day shows an unavailable message.
- Archive coverage starts 2021-06-19 (Wordle), 2018-05-06 (Bee), 2014-08-21 (Mini), 2023-06-12 (Connections). `public/puzzle-archives/manifest.json` records counts, source URLs, hashes and unavailable days (Bee 2018-06-30 has a conflicting answer list and is left out).
- Wordle accepts the 14,855 words of the NYT client (`public/fivefold/words.json`, refreshed by `scripts/sync-wordle-words.py`).
- Krillion uses the original's same-date prompts and answer review (accepted answers, aliases, rarity scores). A day's review is bundled or fetched from the original on first request, then stored.
- Kabloom reads the publisher's `publisher-edition/v1` export for the exact date from `.publisher-editions/kabloom/` (ignored by Git and Vercel, filled by `scripts/publisher-editions.ts refresh|archive kabloom`). A date with no capture shows unavailable, so the game plays only on a machine holding the archive. `/games/kabloom/archive` lists the captured dates before today.
- Anthropeum uses the original's public artifacts and historical polygons, bundled per day in `data/anthropeum`.
- Orbs ranks the publisher's Daily Orbs edition of the date, from 2026-11-26 (`PUBLISHER_ORBS_RANKED_FROM`). The 1 score before that came from the sfjc.dev bank, which is now practice only: `/games/orbs/archive` plays its rounds by category or date, unranked, and `/api/daily/orbs` still serves it. From 2026-12-07 a date without an authored practice edition combines 4 archive rounds on a fixed schedule.
- The server reads the approved Daily Orbs feed by exact date through `/api/orbs/publisher?d=YYYY-MM-DD`. It retains the first full published payload in `daily_game_content` under `publisher-orbs`, including the original date on publisher-designated repeat days. Later reads and the score check reuse that snapshot.
- The publisher’s separate archive starts 2026-04-17. The date picker opens the original edition. `python3 scripts/sync-orbs-publisher.py DIRECTORY` saves the native puzzle records for offline use and resumes by skipping existing snapshots. Chainle’s historical editions can be refreshed with `python3 scripts/sync-chainle.py --archive`.
- The practice bank is `data/orbs/<year>.json`, starting 2026-11-21. After adding a day, regenerate the date-only archive index with `npx tsx scripts/build-orbs-index.ts`. Use `--check` to verify the index after editing the bank.
- `/games/orbs/archive` groups the practice rounds by category through yesterday, and a date can open its full 4-puzzle practice edition. Progress is per date, category and browser. `/games/orbs/local`, the old address of the bank's daily, redirects to `/games/orbs`.
- Outline, Border hop, Pin drop and Ballpark are made on sfjc.dev, not taken from a publisher. `src/lib/geo-games.ts` draws each day's puzzle from the date out of `data/geo/world.json` (193 countries with outline, label point, population, area and land neighbours, and 187 cities), so every date has a puzzle and nothing is fetched or stored. `python3 scripts/build-geo.py COUNTRIES.geojson PLACES.geojson` rebuilds the file from Natural Earth's public-domain `ne_50m_admin_0_countries` and `ne_110m_populated_places_simple`.
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
- Krillion - 7 prompts, 25 seconds each on wall time, so a reload never grants a new clock. Wrong answers can be retried, and the draft is judged once at expiry. Answers are judged on the device from the prompt's answer key, with the server as fallback, by rules fitted to 2,300 recorded verdicts of the original's checker (`judgeWith` in `src/lib/krillion.ts`, 99% agreement). Only an answer's own name scores at once. An alias, a plural or a close spelling replaces the typed text as `"typed" → "answer"` and scores when sent again or when the clock runs out. Close means min(3, length / 4) edits in total, with words under 5 letters exact, 5 to 7 letters 1 edit (2 when the first 2 letters match, from 6), 8 to 11 letters 2 and 12 or more 3, and whole-text comparison when the word count differs. Matching ignores accents, case, apostrophes, punctuation and a leading "a", "an" or "the". Results save the matched answer names, so a later rule change never rejudges a typo. Rarity scores are 10, 15, 30, 60, 85 or 100, maximum 700. No AI judging.
- Kabloom - 7 rounds, each a reading clock then the edition's answer clock (25 seconds), on wall time so a reload resumes the same deadline. Wrong answers can be retried, each answer clears at most 1 round, and an early pick can leave a later round unsolvable. Matching is Krillion's (accents, case, punctuation, leading "the"), and a close misspelling comes back as a suggestion that counts when sent again. The climb ends at the summit or on the first expired clock, and ranks by rounds cleared.
- Anthropeum - 10 artifacts, a map pin and a 250-year period each (125-year steps, 3000 BCE to 1750 CE). Up to 5,000 points for place (distance to the nearest polygon edge) and 5,000 for time, 100,000 overall. 3 free hints per game. The results page shows the original's score histogram and estimated placement.
- Orbs - the publisher's 4 puzzles open on separate screens: matching, sorting, written clues, open answers and long lists. A round has 3 lives and ends when every answer is found or the lives run out. A long list has no lives and ends when full or on End round. Each round earns up to 3 orbs at the publisher's thresholds, and the first finished day ranks, up to 12.
- SET (`/games/set`) - a generated daily board of 12 cards with exactly 6 sets, not the original's board. Not on the leaderboard. `/games/triples` is the full 81-card game with PIN rooms, where each seat holds a private credential and claims use version checks.
- Outline - a country's shape and 6 guesses. A miss shows the distance between the 2 countries' label points and a compass arrow. Scored like Wordle, 7 minus the guesses.
- Border hop - 2 countries that are 2 to 4 countries apart by land. Countries are named in any order until they link the ends, within the shortest count plus 5. 100 for a shortest route, 15 off per extra country, 0 with no route. Each guess is marked by the detour it adds.
- Pin drop - 5 cities on the Anthropeum map with city names hidden. A pin scores 1000 × e^(-km / 1000).
- Ballpark - 3 estimates (a population, an area, a city-to-city distance). Each scores 100 × (1 - |log10(guess / answer)|), floored at 0.
- Within a shelf every game counts the same toward overall wins, streaks and drawer progress, and all show at once in its drawer and score grids. Daily and Beta are counted apart, and nudges count Daily games only.
- Crossword - the full-size daily counts as solved for every player in a room once its grid is correct. The result carries the room and the player's seat, and the server checks both against the day's puzzle and adds the player's word count, so boards show `Solved · 12`. Mini-edition rooms do not count.
- Boards - 1 page: the day's score grid (its game icons filter to 1 game), standings by wins, and Your stats. Equal results share a rank. Rows stored under an older `SCORING_VERSION`, or with a source date that differs from their day, stay off the current boards.

## Verified scores

- Every result sends its moves (`stats.moves`). `/api/results` replays them against the day's puzzle and stores its own score, so a hand-made score cannot be posted.
- Wordle - guesses, word list, hard mode. Bee - found words. Connections - guesses and give-up. Anthropeum - pins and periods. Krillion - each round's accepted answer, judged again. Kabloom - each cleared round's answer ID, its round, single use and answer-clock time. Mini - the solved grid. Orbs - each round's attempts, replayed against the publisher's answers, lives and orb thresholds.
- Solve times (Mini, Connections) and Krillion's round clock cannot be replayed and stay as sent. Mini and Connections times under a floor no person can reach (0.15 s per Mini cell, 1 s per Connections guess) are rejected.
- Outline, Border hop, Pin drop and Ballpark - the guesses, pins or estimates, replayed against the puzzle drawn again from the date.
- Checked moves are kept in a `moves` column that score reads never return, so boards never reveal answers. Only `/api/results/run` reads it, to rebuild a player's finished game. Results saved before 2026-11-21 have no moves and show their score only, until the device that played them opens the day again.

## Players

- Games share the device ID of Daily Log and Notes ([SYNC.md](SYNC.md)). The name is stored locally and on the server, and comes back with the device cookie if local storage is cleared.
- A device playing as `Jon` is an admin of its board: Standings shows rename and remove beside each name (`POST /api/sync/players`, which checks the device's saved name from the sync cookie). A rename moves results and nudge subscriptions, and the renamed player's devices adopt the new name on their next visit (`sync_devices.player_was`). A remove deletes the player's results on that board.
- Friend nudges are web push (`src/lib/push.ts`, `/api/push/*`, handler in `public/e-reader-sw.js`). A subscription is 1 browser filed under a board name, and a nudge goes to every subscription under the friend's name, so all their devices get it. A browser that turns nudges on gets 1 confirming notification. iPhones need the site on the Home Screen. A desktop browser must be running (no tab needed), and a closed one gets the nudge when it next starts, within 12 hours.
- A visitor with no name sees a prompt for one at the top of every page that plays or syncs under it (`NamePrompt`, placed by `PageShell`). It never blocks the page, and "Not now" hides it for the visit. Without a name, collaborative games work as a guest and every other result waits on the device until a name is set.
- Names are unique per board regardless of case, backed by a unique index on the lowercased name. Editing a name does not rewrite earlier results.

## Scripts and tests

- `python3 scripts/sync-nyt-archives.py --through YYYY-MM-DD` resumes the archive download. `--verify-existing` rechecks saved days.
- `python3 scripts/refresh-daily-archives.py krillion` saves the current Krillion review into `data/krillion/review`. `npx tsx scripts/capture-krillion-review.ts` saves it to the database.
- `npx tsx scripts/verify-nyt-daily.ts [day]` checks that all 4 NYT games return that exact day.
- `npm test` runs `tests/*.test.ts` (NYT validation, original mechanics, ranking, SET). `e2e/daily-games.spec.ts` plays each game through to score delivery.
- `scripts/build-basemap.py` rebuilds the Anthropeum map tiles in `public/maps/basemap`.

## Collaborative games

Collaborative games are shared with everyone on a player's board, with no room to create or invite to send. They are `COLLAB_IDS`, last on their shelf: the drawer shows them in a "Together" segment and score grids put them past a rule under a "Together" head. The drawer shows completion marks for the other games, except Krillion and Anthropeum, which show their score.

- Spelling Bee - a player's daily found list is the whole board's, and a visitor with no name shares the public
  board's list (their words are saved under the hidden name `Guest`, which never shows on a board): `/api/spelling-bee/words` merges every
  player's saved words for the day and the page pulls them on load and every 15 seconds. A player's result is saved
  once they add a word of their own, and then carries the shared list.
- Crossword - `/games/crossword` opens the board's 1 shared grid for the day (a room whose id is derived from the
  board code, game, day and edition). Every visitor lands in it, and one with no name yet sits in as a guest. The roster
  counts each player's words: a word goes to the first player to fill its last open square, right or wrong.
  **Change puzzle** leads to the date and edition picker, and **Play together** on
  the Mini opens the board's shared Mini grid.

The Daily drawer's Played grid shows each player's own share in these 2 columns: the Spelling Bee words they were
first on the board to send (`stats.own`, counted by `/api/results`), and the crossword words they filled, read live
from the shared grid (`GET /api/puzzle-rooms?group=&day=`) until the solve saves it in their result.

Each room keeps a snapshot of its puzzle and saves shared progress in Supabase. The same tab can resume the room
after a reload, including edits waiting to sync. An invite link opens the same room for someone on another board.
A browser that rejoins from new tabs counts as 1 of the
100 players and keeps its 3 newest seats. The daily cron deletes rooms left untouched for 30 days.

The crossword opens the original 15×15 daily by default. It uses the bundled schedule through
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

Headcount opens at `/games/headcount`, in the shared daily theme with 1 card per room. `/games/headcount/archive` lists past parties by month with this device's completion marks and a Random pick. The local archive starts with party 37 on 2026-11-26. The daily cron reads the public party feed and stores the first snapshot matching the requested party date. Five guesses replay against that snapshot for a score out of 100. Split and pie use percentage error, ranking and underdog allow two-point crowd ties, and the typical answer uses the ratio to the published median. Publisher guestbook submissions and live publisher standings are separate from the sfjc.dev board.

## Game list status

Aditri's daily games list (2026-11-26). Done means playable here with a ranked score.

| Game              | Original                      | Status                                              |
| ----------------- | ----------------------------- | --------------------------------------------------- |
| Krillion          | krillion.io                   | Done                                                |
| Wordle            | nytimes.com/games/wordle      | Done                                                |
| Connections       | nytimes.com/games/connections | Done                                                |
| Chainle           | chainle.io                    | Done, with archive                                  |
| Daily Orbs        | dailyorbs.com                 | Done, ranked as Orbs                                |
| Headcount         | headcountgame.com             | Done                                                |
| Noillirk          | noillirk.com (Crowdict)       | To do: embedded only at `/games/noillirk`, no score |
| Who's More Famous | whosmorefamous.com            | To do: outside link in the Daily collection         |
| Kabloom           | kabloom.io                    | Native player, waits on the publisher export        |
| Plain             | playplain.app                 | To do: outside link in the Daily collection         |
| Daily Roll        | playdailyroll.com             | To do: outside link in the Daily collection         |
| Bandle            | bandle.app                    | To do: outside link in the Daily collection         |
| Dartle, Kegillion | dartle.net, kegillion.io      | Not wanted                                          |

Fermi, Worldle, Travle and MapTap stay outside links. Ballpark, Outline, Border hop and Pin drop are sfjc.dev's own games of the same kinds, with its own puzzles.
