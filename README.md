# sfjc.dev

A collection of fun games and projects I build and actually use, live at [sfjc.dev](https://sfjc.dev).

Built with Next.js 16 (App Router), TypeScript, Tailwind v4 and Supabase (Postgres + Realtime). Deployed on Vercel, tested with Playwright.

## Projects

- **Web e-reader** (`/games/e-reader`): TXT, PDF and EPUB reader with chapters, highlights, notes, TTS and synced progress
- **Notes** (`/games/notes`): Tiptap notes vault with inline AI lookups, tables, attachments and search
- **1 Sentence Everyday** (`/games/daily-log`): one sentence per day, calendar, export, cross-device sync
- **Daily games** (Daily drawer on the home page): Wordle, Mini, Connections, Spelling Bee, Krillion and Anthropeum for the same Pacific date, with server-checked scores and group leaderboards (`/leaderboards`)
- **Party games** (Quip Clash, Fib It, Enough About You): played from phones with a room PIN (Personal Identification Number)
- **Jeopardy with Friends** (`/games/jeopardy`): custom boards with a shared buzzer
- **Connections** (`/games/connections`): 16-word, 4-group puzzles with a public shelf
- **Smaller games**: 24, 5 Can Sorting, Mental Obstacle Course, Texas Hold'em chip tracker, Chwazi finger chooser, Focus Chimes (`/games/tmr`), Pear Navigator

## Quick start

```bash
npm install
# create .env.local with the variables below
npm run dev                  # http://localhost:3000
```

Scripts:

- `npm run lint`, `npm run type-check`, `npm run build`
- `npm test` (unit tests in `tests/`, Node's test runner through tsx)
- `npm run test:e2e` (Playwright, starts the dev server), `test:e2e:visual`, `test:e2e:deploy` (against the live site). Add a spec name to run 1 area: `npm run test:e2e -- notes`
- Notes: `npm run verify:notes`
- Database: `npm run db:migrations`, `npm run db:push`

Visual baselines live in `e2e/site-visual.spec.ts-snapshots/` (`npm run test:e2e:visual`). Add `--update-snapshots` only after an intentional UI change.

## Project layout

- `src/app/` pages (`games/*`, `leaderboards`) and API routes (`api/*`)
- `src/components/` shared and per-game React components (`PageShell`, `GameCard`, `notes/`, `party/`)
- `src/lib/` game logic, Supabase clients, per-feature libraries
- `e2e/` Playwright specs, `e2e/fixtures/` test assets, `e2e/helpers/` API mocks
- `supabase/migrations/` timestamped SQL, the source of truth for the schema
- `data/` server-only data (daily puzzle snapshots, Jeopardy boards), `public/puzzle-archives/` NYT archives
- `scripts/` verify, seed, sync and build scripts, `tests/` unit tests
- `docs/` architecture map, daily games, design system, Notes and sync notes

Docs:

- [`docs/ARCHITECTURE-MAP.md`](docs/ARCHITECTURE-MAP.md) routes, shared libs, backends
- [`docs/DAILY-GAMES.md`](docs/DAILY-GAMES.md) daily games: sources, cron, rules, score checks
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) visual system
- [`docs/NOTES.md`](docs/NOTES.md) Notes internals
- [`docs/SYNC.md`](docs/SYNC.md) sync, devices and owner access
- [`supabase/README.md`](supabase/README.md) migrations workflow

## Environment variables

Set in `.env.local` locally and in the Vercel dashboard for production.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended, server routes that bypass RLS)
- `OPENROUTER_API_KEY` or `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` (Notes AI, e-reader hints and embeddings)
- `SFJC_SYNC_PASSWORD` (optional, retired owner password, see `docs/SYNC.md`)
- `NOTES_ACTIVE_DOMAIN` (optional, default Notes knowledge domain)
- `TMR_ADMIN_SECRET`, `DAILY_LEARN_ADMIN_SECRET`, `HOME_COMING_SOON_EDIT_SECRET`, `JEOPARDY_LIBRARY_PASSCODE` (optional admin gates)
- `CRON_SECRET` (required, every cron route rejects all calls without it), `CLEANUP_API_KEY` (optional, manual cleanup)
- `VERIDIAN_ORIGIN` (optional, where `/veridian` is proxied)
- Optional model and key overrides for Notes and the e-reader (`NOTES_*`, `READER_*`) are read in `src/lib/notes` and `src/lib/reader`

## Deploy

- Push to `main` and Vercel builds and deploys sfjc.dev.
- Run `npm run build` locally first for risky changes.
- Apply schema changes with `npm run db:push` after committing the migration file.

## Troubleshooting

- Supabase errors: check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and Vercel.
- `db push` says remote versions are missing locally: run `supabase migration list --linked`, see `supabase/README.md`.
- Dev server 500 or missing `routes-manifest.json`: `rm -rf .next && npm run build`.
