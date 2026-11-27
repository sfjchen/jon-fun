# Game playbook

The formula for adding or changing a daily game. Follow it top to bottom and the game comes out with the same header, keys, scores, stats and sync as the others. Mechanics of each current game are in [DAILY-GAMES.md](DAILY-GAMES.md).

## Goals

1. **Faithful** - the original's rules, scoring, marks, wording and keys. A local playable version, never an embed, and nothing is sent to the original.
2. **1 day for everyone** - the Pacific date, the same puzzle for all, and the first finished result is the one that ranks.
3. **Verified** - the server replays the moves and stores its own score.
4. **Open** - a collaborative game is shared with the whole board. No room to create, no invite to send, no name needed to look or help.
5. **1 site** - shared header, Daily drawer, boards, stats, player name and sync. A game adds its board, not its own chrome.
6. **Complete on both inputs** - every action has a key on desktop and a tap target on a phone.
7. **Lean** - reuse the shared pieces below before writing a new one.

## Steps

| #   | Do                                                                                                                                          | Where                                                                | Caught by               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- |
| 1   | Study the original: rules, scoring, reset time, keys, help text, share text, credit and licence                                             | Rules line in `DAILY-GAMES.md`                                       | review                  |
| 2   | Register: `GameId`, a `GAMES` row (title, url, max, unit, rules, `lowerIsBetter`), a place in `GAME_IDS`                                    | `src/lib/results.ts`                                                 | types, registry test    |
| 3   | First playable day                                                                                                                          | `firstDay` in `src/lib/daily.ts`                                     | silent                  |
| 4   | Puzzle for a day, loaded by exact date with no other-day fallback                                                                           | `dailyPuzzle` in `src/lib/daily/server.ts`, data in `data/<id>/`     | runtime error           |
| 5   | Bundle its data files for the server                                                                                                        | `PUZZLES` in `next.config.mjs`                                       | silent, production only |
| 6   | Verifier that replays `stats.moves` into a score                                                                                            | `VERIFIERS` in `src/lib/daily/verify.ts`                             | types                   |
| 7   | Player component with props `{ puzzle, dailyDay }`, added to `LOAD`, `HOW` and the render list                                              | `src/components/daily/<Name>Play.tsx`, `DailyGame.tsx`               | `HOW` by types          |
| 8   | Saved run and device sync: local key `<id>:v1:<day>`                                                                                        | `PREFIX` and `LOCAL` in `saved-run.ts`, `PREFIXES` in `stateSync.ts` | `saved-run` by types    |
| 9   | Route, header and theme: page file, `ownDailyHeader`, `gameTheme`, a `--g-<id>` accent or a sibling's theme (the crossword uses the Mini's) | `src/app/games/<id>/page.tsx`, `PageShell.tsx`, `game-themes.css`    | registry test           |
| 10  | Icon in the notebook doodle style (100×100, `#443e35` stroke 2.4, `#fffdf8` fill)                                                           | `public/doodles/notebook/<id>.svg`                                   | registry test           |
| 11  | Keys: mark the controls and list them                                                                                                       | `GAME_KEYS` in `src/lib/game-keys.ts`, see Keyboard below            | types, registry test    |
| 12  | Score text when it is not a plain number                                                                                                    | `formatGameScore`, `resultLabel`, `compareResults`, `score-stats.ts` | silent                  |
| 13  | Result screen: score, "Saved to your daily scores", Share on `S`                                                                            | the player component                                                 | review                  |
| 14  | Docs: the game record below, route row                                                                                                      | `DAILY-GAMES.md`, `ARCHITECTURE-MAP.md`                              | review                  |
| 15  | Tests: the verifier on a real day, 1 play-through to score delivery                                                                         | `tests/<id>.test.ts`, `e2e/daily-games.spec.ts`                      | CI                      |
| 16  | Check on a production build (`npm run build`, `npx next start -p 3002`), then on sfjc.dev after the deploy                                  | -                                                                    | -                       |

Automatic once step 2 is done - the Daily drawer, score grids, boards, stats, streaks, nudges, Quick jump, the daily cron fetch and the API's game check all read `GAME_IDS`.

`tests/game-registry.test.ts` is the registry test (listed, routed, in `ownDailyHeader`, themed, has an icon and keys). Steps marked silent are not checked by anything, so do them by hand, and add a check there when one can be tested.

## Daily update

1. The daily cron (`/api/cron/daily`, Pacific hours 0-3) calls `dailyPuzzle` for every id in `GAME_IDS`, so a registered game is fetched with no cron change.
2. A game fetched from a source saves the first valid payload for a date in `daily_game_content` and every later read reuses it. A game with bundled files reads them by date. Either way a day never changes after it opens.
3. A page request fetches on demand when the cron has not run yet. A missing day shows "unavailable" with Try again.
4. Past editions are bundled under `data/<id>/` or `public/puzzle-archives/<id>/`, with 1 refresh script in `scripts/` named in the game's source line.

## Order and grouping

- `GAME_IDS` is the only order. The Daily drawer, score grids, boards and Quick jump all follow it.
- Quick word puzzles first (Connections, Wordle, Mini, Spelling Bee), the crossword beside them, then other publishers' games, with the longest games last (Krillion, Anthropeum).
- A new game goes next to the games of its kind and before the long ones. Every game counts the same, so the order never changes a score.
- Games that are not ranked (SET, publisher editions played for history) stay out of `GAME_IDS` and off the boards.

## Game record

Each game is written down the same way, so any game can be compared with any other:

| What                                      | Where                                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| 1 row: source, first day, score, ranks by | "Games at a glance" in `DAILY-GAMES.md`                 |
| Source, archive and refresh script        | 1 bullet under "Puzzle sources"                         |
| Rules as played here, and what ranks      | 1 bullet under "Rules and ranking", starting with title |
| What the server replays                   | 1 clause under "Verified scores"                        |
| Scoring line shown to players             | `rules` in `GAMES`                                      |
| How to play, in play order                | `HOW` in `DailyGame.tsx`                                |
| Keys                                      | `GAME_KEYS`                                             |

## Keyboard

Rules:

1. **1 listener** - mark controls instead of adding a `keydown` listener. `data-hotkey="s"` clicks a control, `data-arrows="grab"` lets the arrows walk a group of buttons, `data-keys` only shows the chip for keys the page handles itself, `useHotkeys` is for keys with no control (`src/components/Hotkeys.tsx`, `src/lib/keyboard.ts`). A game's own `onKeyDown` is only for a text square or input.
2. **The original first** - use the original's keys where it has them. Where it has none, use the table.
3. **Typing games keep letters** - where letters are the input (Wordle, Spelling Bee, crosswords, any answer field), an action never sits on a bare letter while the game is live. Use Enter, Space, ⌫, Esc, Tab, `[` `]`, or Alt with a letter. Bare letters open up once the game is finished.
4. **Every control reachable** - each button has a key or sits in an arrow group.
5. **Leave the browser's keys** - nothing on Cmd or Ctrl except Quick jump (Ctrl/⌘ K).
6. **Shown, not memorised** - a hovered or tabbed control shows its keys in a chip, and the ⓘ panel lists the game's `GAME_KEYS` row plus the shared keys. Both hide on touch screens.
7. **Same key, same job** - a key from the table keeps its job in every game. The 1 exception is rule 2: where the original gives a key another job (Esc is rebus in a crossword), the original wins and the ⓘ row says so.
8. **A game on its own page** (Spelling Bee, the crossword) skips `DailyGame` and the saved run, but still passes its `GAME_KEYS` row to `DayNav` or `Info` and sends results with `logResult`.

| Job                                      | Key                                                       |
| ---------------------------------------- | --------------------------------------------------------- |
| Submit, confirm, start, next round       | Enter (and Space where Space is not typed)                |
| Erase 1 step                             | ⌫ (Del clears in place)                                   |
| Deselect, close, go back                 | Esc                                                       |
| The game's second action (shuffle, turn) | Space                                                     |
| Pick a tile by its spot                  | `1234` `QWER` `ASDF` `ZXCV` (`gridKey`, `gridKeyIndex`)   |
| Pick a numbered answer                   | `1`-`9`                                                   |
| Walk tiles or options                    | Arrows, Home, End                                         |
| Next and previous item (clue, page)      | Tab and Shift+Tab or `]` `[` in a grid, `→` `←` elsewhere |
| Hint                                     | `H`                                                       |
| Pause                                    | `P` (Shift+Esc in a typing game)                          |
| Check and reveal                         | Alt+`S` `W` `P` square, word, puzzle. Add Shift to reveal |
| Expand, zoom                             | `F`, `+` `-` `0`                                          |
| Share or copy the result                 | `S`                                                       |
| How to play and keys                     | `?`                                                       |
| Previous day, next day, today            | `←` `→` `T` after clicking the date                       |
| Jump anywhere                            | Ctrl/⌘ K                                                  |

Each game's current keys are the `GAME_KEYS` rows, the 1 place they are written down.

## Look

- Header - `DayNav` (home, title, Daily drawer, leaderboard, ⓘ, date picker, player name). A game with its own page still uses `Info` and the same order.
- Theme - `data-game-theme` with 1 accent in `--game-color`, white surfaces, sans controls. Colours come from `--ink-*` tokens, buttons from the shared `action` class ([DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)). Only a game whose look is its identity keeps its own skin (Krillion, Anthropeum).
- Phone first - plays at 375 px wide with no sideways scroll, 40 px tap targets, and an on-screen keyboard wherever letters are typed.
- States every game shows - loading, source unavailable with Try again, future preview (unranked), already played on another device, finished.
- Words - plain, sentence case, numerals, status in a `role="status"` line, every icon button has an `aria-label`.

## Scores and stats

- 1 number per day per player, with `max`, `unit` and `lowerIsBetter` set in `GAMES`. Every game counts the same toward wins, streaks and drawer progress.
- The first finished result ranks. A game whose score grows through the day (Spelling Bee) is the only exception and is named in `logResult`.
- Help that solves for the player (check, reveal, give up) makes the result unranked. Help the original ranks (Autocheck) ranks.
- Future days and archive rounds are practice and never rank.
- `logResult(game, score, n, day, { moves, ... })` is the only way a result is sent. A changed scoring rule bumps `SCORING_VERSION`.
- A time that cannot be replayed gets a floor no person can beat.

## Collaborative games

- 1 shared board per group, day and edition, opened by visiting the page. A visitor with no name joins the public board as Guest, which helps the board but never shows on a leaderboard.
- Each player's share is counted and shown (found words in Spelling Bee, words filled in the crossword, where a word goes to the first player to fill its last open square).
- Everyone who took part before the finish gets the result. Joining after it earns nothing.
- Progress is saved on the server, merges across a player's devices, and survives a reload.

## Decide for each new game

- Reset time - originals on Eastern time lag the Pacific day by a few hours. Say so in the rules line.
- Past days - an archive by date, and whether old days rank (they do not).
- Source failure - what shows when a day is missing. Never another day's puzzle.
- Credit - the source, its licence and a link, shown on the page.
- Clock - wall time so a reload grants nothing, paused only where the original pauses.
- Share text - the original's layout, ending in `sfjc.dev`.
- Abuse - rate limit any route that writes, cap anything a visitor can grow.

## Done when

- [ ] `npm run type-check`, `npm run lint`, `npm test` pass, and the game's e2e play-through passes.
- [ ] Played start to finish with the keyboard only, and again on a 375 px screen by touch only.
- [ ] The ⓘ panel lists the rules, the scoring line and the keys.
- [ ] The result reaches the board, survives a reload, and opens as finished on a second device.
- [ ] A hand-made score is rejected by `/api/results`.
- [ ] The docs lines in step 14 are written.
