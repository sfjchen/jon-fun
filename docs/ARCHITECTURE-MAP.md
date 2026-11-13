# sfjc.dev architecture map

Single Next.js app at **`src/`** → [sfjc.dev](https://sfjc.dev) on **Vercel**. **One public theme: Notebook** (`/` + `/games/*`). **Supabase** (PostgreSQL + Realtime) for sync/multiplayer. **Veridian** whiteboard is external (rewrite).

## Agent reading order

| Priority | Doc | When |
|----------|-----|------|
| 1 | [`README.md`](../README.md) | Games list, verify loops, design principles |
| 2 | **This file** | Routes, shared libs, perf, stack boundaries |
| 3 | [`docs/NOTES.md`](NOTES.md) | Notes editor / AI / sync |
| 4 | [`docs/SYNC.md`](SYNC.md) | Shared sync identity, device approval, owner access |

## Routes

| Prefix | Purpose |
|--------|---------|
| `/` | Notebook home grid |
| `/games/*` | All games and tools |
| `/games/notes` | Notes vault (standalone Lato shell) |
| `/leaderboards` | Leaderboards (parked copy) |
| `/admin/*` | Owner admin surfaces (TMR, Notes) |
| `/veridian/*` | Rewrite → external whiteboard |
| `/api/*` | Route handlers |

**Legacy redirects** (permanent): `/theme2` → `/`, `/theme2/games/:path*` → `/games/:path*`, `/notebook` → `/`.

## Projects / backends

| Project | Routes | State | Backend |
|---------|--------|-------|---------|
| **Notes** | `/games/notes` | localStorage + Supabase | `/api/notes/*` |
| **E-reader** | `/games/e-reader` | IndexedDB + optional Supabase | `/api/reader/*` |
| **Daily log** | `/games/daily-log` | localStorage + Supabase | `/api/daily-learn/*` |
| **Poker** | `/games/poker/*` | session + Supabase rooms | `/api/poker/*` |
| **Party games** | quip-clash, fib-it, enough-about-you | sessionStorage + Realtime | `/api/party/*` |
| **Connections** | `/games/connections` | Supabase shelf | `/api/connections/*` |
| **Jeopardy** | `/games/jeopardy` | localStorage + optional Supabase buzzer | `/api/jeopardy/*` |
| **Anthropeum** | `/games/anthropeum` | iframe of anthropeum.com (its own storage) | none |

## Why poker / reader / jeopardy are **not** one stack

| Concern | Poker | Reader | Jeopardy |
|---------|-------|--------|----------|
| **Primary state** | Supabase room + chip stacks | IndexedDB books/chapters | localStorage boards + buzzer room |
| **Realtime** | Postgres changes on seats/pot | Optional communal reading_state | Buzzer + host sync |
| **Heavy deps** | Minimal UI | pdf.js, EPUB, TTS | Board JSON, passcode library API |
| **Shell** | Full-bleed felt table | Standalone reader chrome | Game board + editor |

**Shared infra only:** `src/lib/supabase.ts`, `partyFetch` pattern (party games), `PageShell` where applicable. Merging into one “game engine” would add abstraction without reducing code — each product has different persistence and UX. **Do not unify.**

## Shared party architecture

```
PartyLobbyForm.tsx       ← create/join UI
usePartyLobby.ts         ← sessionStorage, create/join/loadOnce
usePartyRoomActions.ts   ← host start / play-again
usePartyRoomData.ts      ← Supabase Realtime + 2s poll fallback
partyFetch               ← src/lib/party/constants.ts
```

## Notes performance

- **Editor:** single Tiptap instance; `sessionId` prop swaps markdown in-place (no `key=` remount on note switch)
- **Switch path:** optimistic `LOAD_SESSION` dispatch; dirty-note save + sync deferred via `queueMicrotask`
- **Dynamic import:** `EditorShell` → `TiptapNoteEditor` (`ssr: false`)

## Verify

```bash
npm run type-check && npm run build
npm run test:e2e:notes
npm run test:e2e -- party-games connections
npm run test:e2e -- --project=visual-desktop site-visual   # first run: --update-snapshots
```

## Dependencies

- **`@supabase/ssr` removed** — unused (client uses `@supabase/supabase-js` + service routes)
- **`pdfjs-dist` pinned** at 5.4.x — must match `pdf-parse` tracing in `next.config.mjs`
- **Next 16** — upgraded with `eslint-config-next@16`; run official codemods if build warns

## MCP (agents)

- **Supabase:** project `nzviiorrlsdtwzvzodpg`
- **Vercel:** `jon-fun`
- **Playwright:** CLI for regression; plugin for ad-hoc smoke only
