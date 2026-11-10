# sfjc.dev

A collection of fun games and projects I build and actually use, live at [sfjc.dev](https://sfjc.dev).

Built with Next.js 15 (App Router), TypeScript, Tailwind v4 and Supabase (Postgres + Realtime). Deployed on Vercel, tested with Playwright.

## Projects

- **Web e-reader** (`/games/e-reader`): TXT, PDF and EPUB reader with chapters, highlights, notes, TTS and synced progress
- **Notes** (`/games/notes`): Tiptap notes vault with inline AI lookups, tables, attachments and search
- **1 Sentence Everyday** (`/games/daily-log`): one sentence per day, calendar, export, cross-device sync
- **Spelling Bee** (`/games/spelling-bee`): daily puzzle with archive, practice puzzles, hints and ranks
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
- `npm run test:e2e` (Playwright, starts the dev server), `test:e2e:ci`, `test:e2e:deployment` (against live site)
- Notes: `npm run verify:notes-triggers`, `npm run test:e2e:notes`
- Database: `npm run db:migrations`, `npm run db:push`

Visual baselines live in `e2e/site-visual.spec.ts-snapshots/`. Run one viewport project at a time
(`--project=visual-desktop|visual-tablet|visual-mobile`) and add `--update-snapshots` only after an intentional UI change.

## Project layout

- `src/app/` pages (`games/*`, `leaderboards`) and API routes (`api/*`)
- `src/components/` shared and per-game React components (`PageShell`, `GameCard`, `notes/`, `party/`)
- `src/lib/` game logic, Supabase clients, per-feature libraries
- `e2e/` Playwright specs, `e2e/fixtures/` test assets, `e2e/helpers/` API mocks
- `supabase/migrations/` timestamped SQL, the source of truth for the schema
- `data/` seed data (for example Jeopardy boards), `scripts/` verify, seed and build scripts
- `docs/` design system, architecture map, Notes notes, admin notes
- `Veridian/` and `finance/` are separate nested repos, gitignored

Docs:
- [`docs/ARCHITECTURE-MAP.md`](docs/ARCHITECTURE-MAP.md) routes, shared libs, backends
- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) visual system
- [`docs/NOTES.md`](docs/NOTES.md) Notes internals
- [`docs/SYNC.md`](docs/SYNC.md) sync, devices and owner access
- [`supabase/README.md`](supabase/README.md) migrations workflow

## Environment variables

Set in `.env.local` locally and in the Vercel dashboard for production.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended, server routes that bypass RLS)
- `OPENROUTER_API_KEY` or `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` (Notes AI, e-reader hints and embeddings)
- `SFJC_SYNC_PASSWORD` (optional, restricts Notes AI to the owner)
- `NOTES_ACTIVE_DOMAIN` (optional, default Notes knowledge domain)
- `TMR_ADMIN_SECRET`, `DAILY_LEARN_ADMIN_SECRET`, `HOME_COMING_SOON_EDIT_SECRET` (optional admin gates)
- `CRON_SECRET` (required for the daily poker cleanup cron), `CLEANUP_API_KEY` (optional, manual cleanup)

## Deploy

- Push to `main` and Vercel builds and deploys sfjc.dev.
- Run `npm run build` locally first for risky changes.
- Apply schema changes with `npm run db:push` after committing the migration file.

## Troubleshooting

- Supabase errors: check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and Vercel.
- `db push` says remote versions are missing locally: run `supabase migration list --linked`, see `supabase/README.md`.
- Dev server 500 or missing `routes-manifest.json`: `rm -rf .next && npm run build`.
