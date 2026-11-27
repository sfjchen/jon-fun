# sfjc.dev architecture map

1 Next.js 16 app in `src/`, deployed to [sfjc.dev](https://sfjc.dev) on Vercel from `main`. Supabase (Postgres + Realtime) holds sync, multiplayer rooms and scores. The Veridian whiteboard is a separate app behind a rewrite.

Reading order: [`README.md`](../README.md) (projects, scripts, env), this file, then the doc for the area - [`DAILY-GAMES.md`](DAILY-GAMES.md), [`NOTES.md`](NOTES.md), [`SYNC.md`](SYNC.md), [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md), [`supabase/README.md`](../supabase/README.md).

## Routes

| Prefix          | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `/`             | Home grid and the Daily drawer                         |
| `/games/*`      | Every game and tool                                    |
| `/leaderboards` | Daily results, standings and stats per group           |
| `/admin/*`      | Owner admin (TMR, Notes)                               |
| `/veridian/*`   | Rewrite to the external whiteboard (`VERIDIAN_ORIGIN`) |
| `/api/*`        | Route handlers                                         |

Old `/notebook` and `/theme2` URLs redirect in `next.config.mjs`.

## Projects and backends

| Project           | Routes                                                                                       | State                                                       | Backend                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Daily games       | `/games/{wordle,mini,connections/daily,spelling-bee,krillion,anthropeum}`, `/games/archives` | localStorage progress, `game_results`, `daily_game_content` | `/api/daily`, `/api/results`, `/api/cron`, `/api/krillion`, `/api/anthropeum`, `/api/spelling-bee` |
| SET and Triples   | `/games/set`, `/games/triples`                                                               | localStorage, `triples_rooms`                               | `/api/triples`, `/api/match-results`                                                               |
| Notes             | `/games/notes`                                                                               | localStorage + Supabase                                     | `/api/notes/*`                                                                                     |
| E-reader          | `/games/e-reader`                                                                            | IndexedDB + optional Supabase                               | `/api/reader/*`                                                                                    |
| Daily log         | `/games/daily-log`                                                                           | localStorage + Supabase                                     | `/api/daily-learn/*`                                                                               |
| Poker             | `/games/poker/*`                                                                             | session + Supabase rooms                                    | `/api/poker/*`                                                                                     |
| Party games       | quip-clash, fib-it, enough-about-you                                                         | sessionStorage + Realtime                                   | `/api/party/*`                                                                                     |
| Connections shelf | `/games/connections`                                                                         | Supabase shelf                                              | `/api/connections/*`                                                                               |
| Jeopardy          | `/games/jeopardy`                                                                            | Supabase boards, synced recents, optional buzzer room       | `/api/jeopardy/*`                                                                                  |
| 24                | `/games/24`                                                                                  | Supabase rooms                                              | `/api/game24/*`, `/api/match-results`                                                              |
| Focus Chimes      | `/games/tmr`                                                                                 | localStorage + Supabase                                     | `/api/tmr/*`                                                                                       |

Devices and sync keys are shared by all of them through `/api/sync` (see `SYNC.md`).

## Shared pieces

- `src/lib/supabase.ts` - browser client and the server-only admin client.
- `src/lib/api-guards.ts` - cron bearer check and a per-address rate limit.
- `src/components/PageShell.tsx` - picks the shell per route: notebook, game-themed (`data-game-theme`), Notes, full-bleed. A new daily route goes in its `ownDailyHeader` and `gameTheme` lists.
- `src/components/Hotkeys.tsx` + `src/lib/keyboard.ts` - 1 keydown listener for the site. Mark a control with `data-hotkey="k"`, or a grid with `data-arrows`, instead of adding a listener. Hovering or tabbing to a marked control shows its keys in a chip, and `data-keys="k"` gives the same chip to a control whose keys its page handles. `src/lib/game-keys.ts` lists each daily game's keys for its ⓘ panel, and `docs/GAME-PLAYBOOK.md` sets which key does what.
- Party games share `PartyLobbyForm`, `usePartyLobby`, `usePartyRoomActions`, `usePartyRoomData` (Realtime with a 2-second poll fallback) and `partyFetch`.

Poker, the reader and Jeopardy keep separate state and shells on purpose (rooms and chips, IndexedDB books, local boards with a buzzer). Do not merge them into 1 engine.

## Notes performance

- 1 Tiptap instance. The `sessionId` prop swaps markdown in place, with no remount on note switch.
- Note switch dispatches `LOAD_SESSION` at once. The save and sync of a dirty note are deferred with `queueMicrotask`.
- `EditorShell` loads `TiptapNoteEditor` with a dynamic import (`ssr: false`).

## Verify

```bash
npm run type-check && npm test && npm run build
npm run test:e2e -- notes
npm run test:e2e -- party-games connections daily-games
npm run test:e2e:visual
```

## Dependencies

- `pdfjs-dist` is pinned at 5.4.x and must match the `pdf-parse` tracing in `next.config.mjs`.
- Server routes that read files with `fs` need their folders listed in `outputFileTracingIncludes`, or Vercel leaves them out of the function.
