# sfjc.dev (Jon-fun) - rules for Codex

Read `CLAUDE.md` first: run, test, migrations, deploy, docs and conventions are the same for every agent. This file adds what Claude Code keeps in its own notes, so both agents work from the same facts.

## Ground rules

- Lean, fast, simple. Smallest change that meets the goal. No extra docs, verbose copy or new test files beyond 1 per game. Verify with `npm run type-check`, `npm run lint`, `npm test` and a quick browser check.
- Commit, push and deploy everything, always. A push to `main` deploys to sfjc.dev. Check the Vercel build is Ready before calling it live.
- Work in `~/dev/jon-fun`. Other sessions share this checkout and leave uncommitted work, so run `git status` first, and use `git worktree add ~/dev/<name> origin/main` for a broad change. A worktree with a symlinked `node_modules` needs `npx next dev --webpack`.
- Vercel and Supabase CLIs are already logged in and linked (`vercel ls`, `vercel env ls production`, `npm run db:push`). Env keys are in `.env.local`. Never ask for tokens.

## Habits that prevent failed commands

- Quote globs in zsh (`--include='*.ts'`).
- Don't run a command in the same batch as the one that makes its input.
- `git pull --rebase --autostash` before pushing `main`.
- Cleanup deletes only the exact rows a check made (room id, name + day), never a whole test board.
- If a module is missing, check `node_modules/next/package.json` first, then reinstall once.
- Navigation bugs show only on a production build. A `<Link>` that stays on the same page and changes only the query needs `prefetch={false}`. Test routing on `npm run build` + `npx next start -p 3002` or on sfjc.dev, not on `next dev`.
- Wrap type-checks, test runs and builds in `heavy -l` or `heavy` (`~/dev/scripts`). The Mac has 16 GB RAM.

## Daily games

- Rules for adding or changing a game: `docs/GAME-PLAYBOOK.md`. Sources, cron, scoring and the game table: `docs/DAILY-GAMES.md`.
- Who does what, what is done and what is still owed: `docs/DAILY-GAMES-HANDOFF.md`. Update its status section when you finish a piece.
- 2 shelves in `src/lib/results.ts`. `DAILY_IDS` is the 6 original games (Connections, Wordle, Mini, Spelling Bee, Krillion, Anthropeum). `BETA_IDS` is every game added since. Each shelf has its own drawer tab, header button, score grid, standings, streak and stats. A new game always starts in `BETA_IDS`.
- Adding a game touches, in order: `GameId` and `GAMES` and `BETA_IDS` (`src/lib/results.ts`), `dailyPuzzle` (`src/lib/daily/server.ts`), `VERIFIERS` (`src/lib/daily/verify.ts`), the player plus `LOAD`, `HOW` and the render list (`src/components/daily/DailyGame.tsx`), `PREFIX` and `LOCAL` (`src/lib/daily/saved-run.ts`), `PREFIXES` (`src/lib/stateSync.ts`), the page file, `ownDailyHeader` and `gameTheme` (`src/components/PageShell.tsx`), an accent in `src/app/game-themes.css`, an icon in `public/doodles/notebook/<id>.svg`, `GAME_KEYS` (`src/lib/game-keys.ts`), the docs rows and 1 test. `tests/game-registry.test.ts` catches most misses.
- Every game: 1 Pacific day for everyone, the first finished result ranks, the server replays `stats.moves` and stores its own score, and results go out only through `logResult`.
- A game whose puzzles come from a publisher must be served from somewhere the deployed site can read (`daily_game_content` in Supabase, or bundled `data/<id>/`). A game that reads only `.publisher-editions/` shows unavailable on sfjc.dev.

## Codex's part

- Codex: the publisher's dated puzzle fetch and archive for each game, and the original look (formats, controls, fonts, colours, art, animation timings, share text).
- Claude: the player around that data, score replay, shell, sync, boards, stats, archives, tests and release checks.
- Keep Codex's share small. Deliver a loader, a fixture, and the reference captures, then hand the build to Claude.
