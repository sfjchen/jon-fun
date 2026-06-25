# sfjc.dev architecture map

Single Next.js 15 app at **`src/`** → [sfjc.dev](https://sfjc.dev) on **Vercel**. **Supabase** (PostgreSQL + Realtime) for sync/multiplayer. **Veridian** whiteboard is an external Vercel app proxied via rewrite.

## Agent reading order

| Priority | Doc | When |
|----------|-----|------|
| 1 | [`README.md`](../README.md) | Games list, verify loops, design principles |
| 2 | **This file** | Route inventory, shared libs, duplication boundaries |
| 3 | [`docs/NOTES-AGENT.md`](NOTES-AGENT.md) | Notes editor / AI / sync |
| 4 | [`docs/SFJC-ADMIN.md`](SFJC-ADMIN.md) | Owner sync password, admin device UUIDs |
| 5 | [`.cursor/rules/`](../.cursor/rules/) | Supabase MCP, Playwright CLI, git, Vercel |

## Route trees

### Canonical (public)

| Prefix | Purpose |
|--------|---------|
| `/` | Notebook home grid |
| `/games/*` | All live games and tools |
| `/games/notes` | Notes vault (standalone Lato shell) |
| `/veridian/*` | Rewrite → external whiteboard (`VERIDIAN_ORIGIN`) |
| `/api/*` | Route handlers (party, notes, reader, poker, …) |

### Theme2 mirror (legacy Ink & Paper entry points)

| Prefix | Purpose |
|--------|---------|
| `/theme2` | Alternate home grid (visual-regression + Connections mirror) |
| `/theme2/games/connections/*` | Connections with `basePath="/theme2/games/connections"` |
| `/theme2/games/*` (other) | Thin re-exports of same components as `/games/*` |

**Do not delete** `/theme2` without updating `e2e/theme2-*.spec.ts` and Connections `basePath`. Prefer editing shared components under `src/components/` — both trees stay in sync automatically.

Archive-only copy: `src/app/_archive/theme2` (Next private folder — not routed).

## Projects / domains

| Project | Routes | State | Backend |
|---------|--------|-------|---------|
| **Notes** | `/games/notes` | localStorage + Supabase sync | `/api/notes/*`, owner-gated AI |
| **E-reader** | `/games/e-reader` | IndexedDB + optional Supabase | `/api/reader/*` |
| **Daily log** | `/games/daily-log` | localStorage + Supabase | `/api/daily-learn/*` |
| **Poker** | `/games/poker/*` | session + Supabase rooms | `/api/poker/*` |
| **Party games** | quip-clash, fib-it, enough-about-you | sessionStorage + Realtime | `/api/party/*` |
| **Connections** | `/games/connections` + theme2 mirror | Supabase shelf | `/api/connections/*` |
| **Jeopardy, 24, MOC, …** | `/games/*` | Mostly localStorage | Minimal or none |

## Shared architecture (coalesced)

### Party games (`src/components/party/`)

```
PartyLobbyForm.tsx     ← create/join UI (Quip Clash, Fib It, Enough About You)
usePartyLobby.ts       ← sessionStorage, create/join/loadOnce
usePartyRoomData.ts    ← Supabase Realtime + 2s poll fallback
partyFetch             ← src/lib/party/constants.ts (25s timeout)
/api/party/rooms       ← unified room CRUD + start/play-again
/api/party/{quiplash|fibbage|eay}/[pin]  ← game actions
```

### Notes (`src/components/notes/`, `src/lib/notes/`)

- **Editor:** Tiptap via dynamic import (`EditorShell.tsx` → `TiptapNoteEditor.tsx`)
- **App shell:** `NotesApp.tsx` + `SidePanel.tsx` (reducer state)
- **Sync:** `storage.ts` mutex + BroadcastChannel tab sync
- **AI:** `streamClient.ts` → `/api/notes/lookup` (sync password + admin devices when env set)

### Page chrome

- **`PageShell.tsx`** — notebook masthead, `sfjc.dev` → home
- **Exceptions:** Notes (minimal), Poker lobby/table (full-bleed), Pear Navigator, Chwazi mobile

## Performance levers

| Area | Mechanism |
|------|-----------|
| Bundle | `next.config.mjs` → `optimizePackageImports` (Tiptap, Supabase, lucide, Vercel analytics) |
| Notes editor | `dynamic(..., { ssr: false })` for Tiptap |
| Notes app | `NotesAppLoader.tsx` dynamic import |
| Party rooms | Realtime primary; poll every **2s** as fallback (was 800ms) |
| Reader/Jeopardy | `outputFileTracingIncludes` for pdf.js + board JSON |

## Known duplication (intentional)

- **`/theme2/games/*` page.tsx** — one-liner re-exports; keep until theme2 visual suite retargets to `/games/*`
- **Poker vs party** — separate APIs (poker chip tracker ≠ Jackbox-style party rooms)
- **Veridian** — separate repo/deploy; only rewrite lives here

## Verify commands

```bash
npm run type-check
npm run build
npm run test:e2e:notes          # Notes regression
npm run test:e2e -- party-games   # Party lobby smoke
npm run test:e2e -- theme2-visual # Theme2 snapshots (visual-* projects)
```

## MCP (agents)

- **Supabase:** `apply_migration` for `supabase/migrations/` — project `nzviiorrlsdtwzvzodpg`
- **Vercel:** deploy status for `jon-fun`
- **Playwright:** ad-hoc smoke only; **CLI** for regression (see `.cursor/rules/playwright-testing.mdc`)
