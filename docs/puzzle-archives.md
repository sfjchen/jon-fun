# Historical puzzle archives

Browse `/games/archives`, linked from the Connections library. Connections opens in the existing player without Supabase. Mini supports typing into the grid, selecting clues, keyboard navigation, checking answers, revealing and resetting. Download links expose each year's normalized games and the distinct answer/word lists.

## Daily play and history

The home page and leaderboard link to Mini, Connections, Spelling Bee, Krillion and Anthropeum. Every daily route accepts `?d=YYYY-MM-DD`, with previous/next controls. All players use the Pacific calendar. Future dates are practice and cannot submit scores; previews remain unranked after their date arrives. Mini and Bee use deterministic historical selections where no same-date source puzzle exists; the UI displays the source date. Original Mini/Connections archives remain at `/games/archives`. All 793 historical Bee hives are selectable inside Spelling Bee and are practice rather than ranked daily runs.

Connections contains 1,248 text puzzles through 2026-11-16. The image/empty-word puzzle on 2025-04-01 is excluded; puzzles without recorded difficulties use neutral group colors. Mini contains 3,737 full grids through 2024-11-12. Bee contains 793 dated, exact accepted-answer lists from 2023-01-01 through 2025-03-05.

## Scores

Results save locally before syncing, survive a transient failure, and attach to a player after name/group setup. The shared results API stores per-game, per-player, per-day best scores with atomic conditional updates. Past daily play files against the selected day; future submissions are rejected on the server. Checking or revealing a Mini makes the run unranked, including after reset. Connections resumes its guesses, Mini resumes its grid/timer, Bee resumes found words, and the other games resume rounds. 24 remains playable but no longer sends or appears in results.

The leaderboard supports public or private groups, a selectable calendar, per-game daily winners (ties count; at least two players required), overall day champions by number of game wins, an overall days-won tally, a 14-day personal trend, seven-day averages over played days, streaks, best/average scores, wins and game-specific stats. It refreshes on score updates, focus and a 15-second interval. Use the same name/group across devices to view the same results.

## Krillion and Anthropeum

Krillion captures the original public `/api/today` prompts into the service-only `daily_game_content` table. Vercel calls `/api/cron/krillion` daily at 04:30 UTC; visiting the current daily also attempts capture. The following day's local daily requests the previous source date. It never requests the paid archive. The first captured source is 2026-11-16, so earlier daily slots offer an explicitly unranked practice set. Local scoring awards 1,000 per accepted answer across seven 25-second rounds; it does not reproduce official rarity scores. The checked bank covers the first captured set. An optional Gemini judge handles answers outside that bank and new prompts; it needs available credits. If that service is unavailable, unrecognized answers in a checked bank do not score, and prompts without a bank retain the submitted answer for retry rather than treating it as wrong.

Anthropeum uses the original public dated artifact sets and historical region boundaries in a native player. Location/date scoring is local (500 each per artifact), and the UI identifies this. Dated snapshots for November 15–16 provide an offline source fallback; live dates load from the public source when available. Origin polygons, image metadata and museum links are preserved.

## Refresh and verification

`python3 scripts/refresh-daily-archives.py connections bee` refreshes those banks and the manifest. The original `scripts/import-puzzle-archives.py` seeds Mini and the older Connections snapshot; run the refresh script afterwards if reseeding. Source links and hashes/counts are in `public/puzzle-archives/manifest.json`.

`e2e/daily-games.spec.ts` checks complete gameplay and client score delivery. With a configured local server, `npx tsx scripts/verify-daily-results.ts` verifies real database writes, history, group isolation, concurrent best-score behavior and rejection of 24/future scores using an isolated group removed afterwards.
