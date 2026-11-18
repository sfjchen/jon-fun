# Historical puzzle archives

Browse `/games/archives`, linked from the Connections library. Connections opens in the existing player without Supabase. Mini supports typing into the grid, selecting clues, keyboard navigation, checking answers, revealing and resetting. Download links expose each year's normalized games and the distinct answer/word lists.

## Daily play and history

The home page and leaderboard link to Mini, Connections, Spelling Bee, Krillion and Anthropeum. Every daily route accepts `?d=YYYY-MM-DD`, with previous/next controls. All players use the Pacific calendar. Future dates are practice and cannot submit scores; previews remain unranked after their date arrives. Mini and Bee use deterministic historical selections where no same-date source puzzle exists; the UI displays the source date. Original Mini/Connections archives remain at `/games/archives`. All 793 historical Bee hives are selectable inside Spelling Bee and are practice rather than ranked daily runs.

Connections contains 1,248 text puzzles through 2026-11-16. The image/empty-word puzzle on 2025-04-01 is excluded; puzzles without recorded difficulties use neutral group colors. Mini contains 3,737 full grids through 2024-11-12. Bee contains 793 dated, exact accepted-answer lists from 2023-01-01 through 2025-03-05.

## Game mechanics and scores

Results save before syncing and retry on reconnection. Old local-scoring rows are preserved as a separate scoring version and can be inspected on the leaderboard; they do not compete with original-rule results. Date navigation and historical practice remain supported. Future previews stay unranked.

- Mini: active solve time, manual pause and automatic pause when leaving; resume behind a hidden-grid overlay. The timer starts with Start, stops on completion, and resets when the grid is cleared. The first unassisted completed time is the ranked result; checks, reveals and autocheck mark assistance. Tab/Shift+Tab, direction arrows, Space, Backspace, pencil mode and scoped square/word/puzzle help are supported. Lower time wins.
- Connections: four groups, four mistakes, one-away feedback, repeat-guess protection, four-column layout, and retained selection after a wrong guess. Standings compare groups solved and then mistakes, rather than invented point totals.
- Spelling Bee: exact source answer lists, center-letter validation, four-letter minimum, original word/pangram points and rank thresholds. Form controls no longer receive game keyboard shortcuts. Revealing a past/practice hive persists and ends word entry.
- Krillion: same-date original prompts, 3-second preview and 25-second answer deadline. Invalid guesses can be retried while the same clock runs. At expiry, the current draft is submitted once. Pausing shifts the deadline; reloading never grants a new full timer. The game uses the original accepted answers, aliases and six rarity scores (10/15/30/60/85/100), plus conservative confirmed spelling suggestions. The seven-round maximum is 700. Complete the run to search and page through the full answer review. No AI judging is used.
- Anthropeum: original public artifacts and historical polygons, 250-year guess intervals, nearest polygon-edge distances, and original exponential scoring (up to 5,000 location plus 5,000 time points per artifact, 100,000 overall). The map supports pan, zoom, pinch and keyboard placement. The last round's feedback is shown before final results.

Krillion's original November 17 review was observed after completing one normal run; the local scorer reproduces that run's 90-point result. The current-day public review can also be captured without submitting additional games. The bundled compressed key contains 110,153 accepted answers across seven prompts. The cron captures the public current-day prompts and review at 05:10 UTC into server-only storage. It never uses the paid archive or silently substitutes another date. Earlier days without a captured original key are unavailable rather than approximated with a made-up answer bank.

## Refresh and verification

`python3 scripts/refresh-daily-archives.py connections bee` refreshes those historical banks. Add `krillion` to save a current original answer key locally. `npx tsx scripts/capture-krillion-review.ts` captures the current review into the configured server database. Neither submits game results to Krillion.

`tests/original-mechanics.test.ts` covers timers, original-key scoring/aliases, interval and boundary math, ranking direction and Bee rules. `e2e/daily-games.spec.ts` exercises full play, invalid-answer retries, timeout submission, pause/reload, scoped assistance, post-game reviews and score delivery. `scripts/verify-daily-results.ts` verifies database versions, immutable first Mini times, Connections tiebreaks and group separation using an isolated group removed afterwards.

Mechanics references: [NYT Mini help](https://thenewyorktimeshelpcenter.helpjuice.com/360025912452-The-Mini-Crossword), [Connections help](https://thenewyorktimeshelpcenter.helpjuice.com/360011158491-New-York-Times-Games/28525912587924-Connections), [Spelling Bee help](https://thenewyorktimeshelpcenter.helpjuice.com/360011158491-New-York-Times-Games/23675493312404-Spelling-Bee), original Krillion gameplay/review and Anthropeum's published client scoring.

## Remembered player and game surfaces

Games share the existing device ID with Daily Log and Notes. A name entered through the pencil control is stored locally and on the server, and restored with the long-lived device cookie if local storage is cleared. Future results carry the device ID; future note/log device stamps and reader comments reuse the name. Editing the name does not rewrite earlier results. The leaderboard retains optional group selection. Existing saved daily-game names migrate automatically.

Daily game headers put Home, the title, leaderboard and help on the same row. Krillion uses a pixel ocean surface and VT323 typography; Anthropeum uses its parchment/burgundy palette, serif typography, map, artifact photograph viewer and timeline within sfjc.dev. NYT game surfaces use white backgrounds, sans-serif controls and the games’ colors. These are local playable implementations, not embedded upstream pages. The November 17 Anthropeum collection is bundled for durable replay.

## SET

`/games/set` provides a deterministic daily board of twelve classic cards containing exactly six sets. Cards use red, green and purple, the oval/diamond/squiggle shapes, and solid/striped/open shading. These are generated sfjc.dev puzzles, not fetched original daily boards; the original puzzle endpoint was unavailable when this was implemented. Dates, active-time pause/resume, saved found sets, duplicate detection and assisted practice are supported. Unassisted completions join the common leaderboard; equal set counts compare completion time, with the first completed time retained.

`/games/triples` provides the full 81-card solo game and PIN rooms. Room mutations use optimistic version checks so simultaneous claims cannot both score the same cards. Late polling responses cannot replace a newer board. Room membership survives reload; leaving transfers host control and removes an empty room. The existing cleanup cron also removes stale rooms.

The remaining name-recovery fixes separate untouched legacy lobby fallbacks from user-edited drafts, so a cookie-restored name can replace a stale lobby name. Existing saved game names also replace old Notes device labels. Tests cover both migrations, all six daily leaderboard flows, the SET rules/deck, daily generation, full solo completion and two-player synchronization. Classic card features follow the [publisher’s SET rules](https://www.playmonster.com/wp-content/uploads/2020/01/SETRules.pdf).

Room actions also require a private per-seat credential returned only to the joining player; public roster IDs do not authorize claims or host actions. Temporary storage failures return 503 and retain the local seat, while only a genuine 404 clears it. An explicit invite to a different room opens that lobby without discarding the previous saved membership. Server and browser regressions cover these cases.
