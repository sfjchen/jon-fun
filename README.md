# Jon-fun - Game Hub

A personal collection of fun games built with Next.js, TypeScript, and Supabase. Deployed at [sfjc.dev](https://sfjc.dev).

## 🎮 Games

- **24 Game** (`/games/24`): Use 4 numbers and basic arithmetic to make 24
- **Jeopardy with Friends** (`/games/jeopardy`): Create and play custom Jeopardy boards locally
- **Texas Hold'em** (`/games/poker`): Poker chip tracker with real-time multiplayer lobbies
- **Chwazi Finger Chooser** (`/games/chwazi`): Place fingers on screen to randomly select a winner
- **TMR System** (`/games/tmr`): Targeted Memory Reactivation for learning and sleep
- **1 Sentence Everyday** (`/games/daily-log`): One sentence per day, history, calendar, export, cross-device sync (localStorage + Supabase)
- **Pear Navigator** (`/games/pear-navigator`): PearPad tablet simulator—Procreate, Notion, Figma guides; tap UI elements to advance; MS&E 165 demo; A/B test results at `/games/pear-navigator/results`
- **Mental Obstacle Course** (`/games/mental-obstacle-course`): Six-round playful benchmark (reaction, arithmetic, patterns, digit memory, words, trivia) with a radar chart by domain; scores and history in **localStorage** only (no accounts)
- **Quip Clash** (`/games/quip-clash`): Party room (4-digit **PIN** — Personal Identification Number) — Quiplash-style paired prompts, sequential votes, round multipliers, final round; **Supabase** (PostgreSQL) + **Realtime**; session keys `party_quiplash_*`
- **Fib It** (`/games/fib-it`): Fibbage-style bluff trivia — lies, shuffled options, picks, likes, 3 rounds; 2–8 players; `party_fibbage_*` session keys
- **Enough About You** (`/games/enough-about-you`): Intake questions, subject rounds (reputation bonus), final truth-vs-lie vote per player; 3–8 players; `party_eay_*` session keys

## 🚀 Quick Start

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

## 🎨 Core design principles

These guide **what** we build (product + UX) and **how** it should feel (visual tone). **Implementation details** (hex values, font stacks, component tokens) stay in **[docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)** and `globals.css`.

### Audience and context

- **Primary audience:** Personal use first; occasionally **friends and professional acquaintances**. Optimize for **honest utility and low cognitive load**, not growth metrics or onboarding funnels.
- **Devices:** Design for **laptop and mobile** by default. Some experiences are **intentionally skewed** (e.g. Chwazi on **touch-only** mobile; dense editors may lean **desktop**). When a flow is one-sided, say so in the game blurb or UI once—don’t scatter disclaimers.

### Interaction and information architecture

- **Direct, simple, concrete:** Every label, helper paragraph, and button must **earn its place**. Prefer **removing** or **deferring** (progressive disclosure) over decorating. Copy should state the next action, not market the product.
- **Flat navigation:** Prefer **few steps** from home to the main task (e.g. home grid → game). Avoid deep hierarchies; if you need sections, use **obvious siblings** (tabs, side column) instead of nested “settings inside settings.”
- **Balanced density:** **Not** ultra-minimal to the point of mystery, **not** dashboard clutter—enough structure to scan, not more.

### Global chrome (`PageShell`)

- **`sfjc.dev` masthead** appears across games and tools in a **consistent role**: same centered title treatment as on the home page, and **always links to the correct home** (`/` on Main theme, `/theme2` when browsing Theme 2). Subpages keep **← Home** for explicit back navigation where useful.
- **Exceptions** (compact header, full-bleed): Pear Navigator, Chwazi mobile, Poker lobby/table—still branded **sfjc.dev**, still wired to home (see `PageShell.tsx`).

### Visual and tonal language (ties to themes)

- **Simple, bold, elegant:** Strong type and a **restrained palette**—confident without being stiff (**not** corporate-formal) and clear without being cute (**not** overly casual copy or novelty UI).
- **Two public faces:** **Notebook** (`/`)—hand-drawn Patrick Hand, cream line-paper, Stanford-adjacent red accent. **Ink & Paper** (`/theme2`)—Lora + Charter, cream + burgundy. Game-specific skins (Poker felt, Pear Navigator dark) are **allowed exceptions** where they aid the metaphor.

### Data, identity, and sync

- **No mandatory accounts** for personal tools when avoidable. Prefer **local-first state** (e.g. `localStorage`, session storage) so each device has an **immediate, offline-tolerant** experience.
- **Optional cloud sync** without sign-in friction: background or periodic merge to **Supabase** when it improves continuity—**1 Sentence Everyday** is the reference pattern (local draft + sync, visibility-aware intervals).
- **Multiplayer / rooms** (Poker, Game 24, etc.) use **ephemeral pins and session identity** as needed; that’s separate from “my personal journal data.”

---

## 🎨 Visual system & themes (quick reference)

**Themes:** **Notebook** (default at `/`) and **Ink & Paper** at `/theme2`. **Tokens:** `var(--ink-*)` in `globals.css`; notebook maps those to `--nb-*` via `data-theme="notebook"`. **Game-specific:** Poker (green felt), Pear Navigator (dark inner UI). **Own-theme / compact header:** Chwazi mobile, Pear Navigator, Poker lobby & table; theme switch is **hidden** on Chwazi mobile. Full detail: **[docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)**.

---

## 📦 Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Analytics**: Vercel Analytics & Speed Insights

## 📁 Project Structure

```
src/
├── app/
│   ├── api/poker/          # API routes for poker game
│   │   ├── actions/        # Player betting actions
│   │   ├── cleanup/        # Cron job for inactive rooms
│   │   └── rooms/          # Room management (CRUD)
│   ├── games/              # Game pages
│   │   ├── 24/
│   │   ├── jeopardy/
│   │   ├── poker/
│   │   ├── chwazi/
│   │   ├── tmr/
│   │   ├── daily-log/
│   │   ├── pear-navigator/
│   │   ├── mental-obstacle-course/
│   │   ├── quip-clash/
│   │   ├── fib-it/
│   │   └── enough-about-you/
│   ├── leaderboards/       # Leaderboards page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # React components
│   ├── PageShell.tsx       # Shared layout (sfjc.dev header, back link)
│   ├── GameCard.tsx        # Paper card for game grid (Ink & Paper)
│   ├── Game24.tsx
│   ├── JeopardyEditor.tsx
│   ├── JeopardyPlayer.tsx
│   ├── ChwaziGame.tsx
│   ├── PokerTable.tsx
│   ├── PokerLobby.tsx
│   ├── PokerPlayer.tsx
│   ├── PokerChips.tsx
│   ├── PokerJoinForm.tsx
│   ├── TMRManager.tsx
│   ├── DailyLearnManager.tsx
│   ├── PearNavigator.tsx
│   ├── MentalObstacleCourse.tsx
│   └── party/              # Quip Clash, Fib It, Enough About You (shared hook + UIs)
└── lib/                    # Utility libraries
    ├── party/              # Party game types, prompts, seed/scoring helpers
    ├── supabase.ts         # Supabase client
    ├── poker.ts            # Poker types & utilities
    ├── jeopardy.ts         # Jeopardy types & utilities
    ├── tmr.ts              # TMR config & session storage
    ├── dailyLearn.ts       # 1 Sentence Everyday (localStorage)
    ├── solver24.ts         # 24 Game solver algorithm
    └── mental-obstacle-course.ts  # Mental Obstacle Course domains, scoring, local persistence, ?mocE2e=1 timings
```

## 🗄️ Database Schema (Supabase)

### Tables

**`poker_rooms`**

- `id` (uuid, primary key)
- `pin` (text, unique, 4-digit room code)
- `host_id` (uuid)
- `small_blind` (integer)
- `big_blind` (integer)
- `timer_per_turn` (integer, optional)
- `status` (text: 'waiting' | 'active' | 'finished')
- `created_at` (timestamp)
- `last_activity` (timestamp, indexed for cleanup)

**`poker_players`**

- `id` (uuid, primary key)
- `room_pin` (text, foreign key → poker_rooms.pin)
- `player_id` (uuid, unique per player)
- `name` (text)
- `chips` (integer)
- `position` (integer, 0-11)
- `is_active` (boolean)
- `is_all_in` (boolean)
- `current_bet` (integer)
- `hole_cards` (jsonb, Card[])
- `has_folded` (boolean)
- `has_acted` (boolean)

**`poker_game_state`**

- `room_pin` (text, foreign key → poker_rooms.pin)
- `hand_number` (integer)
- `betting_round` (text: 'preflop' | 'flop' | 'turn' | 'river')
- `current_bet` (integer)
- `dealer_position` (integer)
- `small_blind_position` (integer)
- `big_blind_position` (integer)
- `action_on` (integer)
- `pot_main` (integer)
- `pot_side_pots` (jsonb)
- `community_cards` (jsonb, Card[])
- `is_game_active` (boolean)

**`poker_actions`**

- `room_pin` (text, foreign key → poker_rooms.pin)
- `hand_number` (integer)
- `player_id` (uuid)
- `action` (text: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in')
- `amount` (integer)
- `timestamp` (timestamp)

**`game24_rooms`**

- `id` (uuid, primary key)
- `pin` (text, unique, 4-digit)
- `host_id` (uuid, nullable)
- `status` ('waiting' | 'active' | 'intermission' | 'finished')
- `round_number` (integer)
- `current_round_started_at`, `intermission_until` (timestamptz)
- `max_players` (integer, default 20)
- `created_at`, `updated_at`, `last_activity` (timestamptz)

**`game24_players`**

- `id` (uuid, primary key)
- `room_pin` (text, fk → game24_rooms.pin)
- `player_id` (uuid)
- `name` (text)
- `score` (integer)
- `is_connected` (boolean)
- `joined_at` (timestamptz)

**`game24_rounds`**

- `room_pin` (text, fk → game24_rooms.pin)
- `round_number` (integer)
- `numbers` (integer[])
- `started_at` (timestamptz)

**`game24_submissions`**

- `room_pin` (text, fk → game24_rooms.pin)
- `round_number` (integer)
- `player_id` (uuid)
- `expression` (text)
- `is_correct` (boolean)
- `score_awarded` (integer)
- `submitted_at` (timestamptz)

**Party games** (shared `party_rooms` + `party_players`; per-game tables — see `supabase-migration-party-games.sql`)

- **`party_rooms`**: `pin`, `host_id`, `game_kind` (`quiplash` | `fibbage` | `eay`), `phase`, `round_index`, `step_index`, `deadline_at`, `settings` (jsonb), `version`, `max_players`, `last_activity`
- **`party_players`**: `room_pin`, `player_id`, `name`, `score`, `joined_at`
- **Quiplash-like**: `party_quiplash_matchups`, `party_quiplash_answers`, `party_quiplash_votes`, `party_quiplash_final_prompt`, `party_quiplash_final_answers`, `party_quiplash_final_votes`
- **Fibbage-like**: `party_fibbage_rounds`, `party_fibbage_lies`, `party_fibbage_picks`, `party_fibbage_likes`
- **Enough About You-like**: `party_eay_intake`, `party_eay_rounds`, `party_eay_lies`, `party_eay_picks`, `party_eay_likes`, `party_eay_final`, `party_eay_final_picks`

**`daily_learn_entries`**

- `id` (uuid, primary key)
- `user_id` (text), `date` (date), `text` (text), `updated_at` (timestamptz)
- Unique on `(user_id, date)` for cross-device sync

**`tmr_study_sessions`**

- `id` (uuid, primary key)
- `user_id` (text), `start`, `end` (timestamptz), `duration_minutes` (numeric), `cues_played`, `cue_interval_seconds` (integer), `interrupted` (boolean), `created_at` (timestamptz)

**`tmr_sleep_sessions`**

- `id` (uuid, primary key)
- `user_id` (text), `start`, `end` (timestamptz), `duration_minutes` (numeric), `total_cues`, `cycles` (integer), `created_at` (timestamptz)

### Indexes

- `idx_tmr_study_sessions_created_at`, `idx_tmr_sleep_sessions_created_at`
- `idx_poker_rooms_last_activity` on `poker_rooms(last_activity)` for cleanup queries
- `idx_game24_rooms_last_activity` on `game24_rooms(last_activity)`
- `game24_rounds_room_pin_round_number_key`
- `idx_game24_submissions_room_round` / `idx_game24_submissions_player_round`
- `idx_party_rooms_last_activity` on `party_rooms(last_activity)` (cleanup)

## 🔌 API Routes

**`POST /api/poker/rooms`**: Create new poker room

- Body: `{ hostName, smallBlind?, bigBlind?, timerPerTurn? }`
- Returns: `{ pin, hostId, playerId }`

**`GET /api/poker/rooms/[pin]`**: Get room data

- Returns: Room with players and game state

**`POST /api/poker/rooms/[pin]`**: Join room or start game

- Body: `{ action: 'join' | 'start', playerName?, position?, hostId? }`

**`PATCH /api/poker/rooms/[pin]`**: Update room settings

- Body: `{ timer_per_turn?, hostId }`
- Only host can update

**`POST /api/poker/actions`**: Player betting action

- Body: `{ pin, playerId, action, amount? }`

**`POST /api/poker/cleanup`**: Cleanup inactive rooms (cron)

- Deletes poker, Game 24, and **party** (`party_rooms`) rooms inactive >24 hours (party child rows cascade on room delete)
- Requires `CLEANUP_API_KEY` env var (optional)

**Party games** (`/api/party/…`)

- **`POST /api/party/rooms`**: `{ hostName, gameKind: 'quiplash' | 'fibbage' | 'eay' }` → `{ pin, hostId, playerId }`
- **`GET /api/party/rooms/[pin]`**: Room, players, game payload (`quiplash` | `fibbage` | `eay`)
- **`POST /api/party/rooms/[pin]`**: `join` | `start` | `leave` | `play-again` (host reset)
- **`POST /api/party/quiplash/[pin]`**, **`/api/party/fibbage/[pin]`**, **`/api/party/eay/[pin]`**: game actions (answers, votes, advance, etc.)

**`POST /api/game24/rooms`**: Create Game24 room (4-digit PIN)

- Body: `{ hostName }`
- Returns: `{ pin, hostId, playerId }`

**`GET /api/game24/rooms/[pin]`**: Room, players, current round numbers

**`POST /api/game24/rooms/[pin]`**:

- `action: 'join'` `{ playerName }`
- `action: 'start'` `{ playerId }` (any player; needs ≥1 player)
- `action: 'play-again'` `{ playerId }` (resets lobby, caller becomes host)

**`POST /api/game24/submit`**: Submit expression; validates with round numbers; scores 1000→0 over 15s (one correct per player/round)

**`POST /api/game24/next-round`**: Advance state (active → intermission (5s) → next round up to 8, then finished)

**`GET /api/daily-learn/entries?userId=`**: Fetch entries for sync key/user

**`POST /api/daily-learn/entries`**: Upsert entries – Body: `{ userId, entries: [{ date, text }] }`

**`GET /api/daily-learn/admin/keys`**: List distinct user_ids for recovery; optional `?key=DAILY_LEARN_ADMIN_SECRET`

**`POST /api/tmr/study`**: Sync TMR study session to DB – Body: `{ userId, session }`

**`POST /api/tmr/sleep`**: Sync TMR sleep session to DB – Body: `{ userId, session }`

**`GET /api/tmr/admin/entries`**: Admin only; query `?key=TMR_ADMIN_SECRET`. Returns all study and sleep sessions.

## 💻 Coding Conventions & Patterns

### React Optimization

- **Always use `useCallback`** for functions passed as props or in dependencies
- **Use `useMemo`** for expensive computations
- **Wrap components in `memo()`** if they receive stable props (e.g., `PokerChips`, `PokerPlayer`)
- **Functional state updates** when state depends on previous state

### TypeScript

- **No `any` types** - use proper interfaces/types
- **Strict mode enabled** - `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Define interfaces** for API request/response bodies

### Code Quality

- **No `console.log/error/warn`** statements
- **Use `@/` alias** for imports (not relative paths like `../../../`)
- **Parallelize operations** with `Promise.all` for independent database calls
- **Consistent error handling** - no unused error parameters in catch blocks
- **Use nullish coalescing (`??`)** for default values

### State Management

- **React hooks** for component state
- **`sessionStorage`** for poker game state (hostId, playerId, playerName)
- **Supabase Realtime** subscriptions for multiplayer updates

### API Routes

- **Proper error handling** with try/catch
- **Validate inputs** before database operations
- **Return appropriate HTTP status codes** (400, 401, 403, 404, 500)
- **Update `last_activity`** on room mutations

## 🔄 Workflow & Deployment

### Development Workflow

- **Work directly on `main` branch** (no feature branches)
- **Optional**: `npm run dev` to smoke-test locally before pushing
- **Use `git acp -m "message"`** to add/commit/push in one step
- **Vercel auto-deploys** on push (1-3 minutes); verify via Vercel dashboard or https://sfjc.dev and redeploy latest if env vars change

### ⚠️ IMPORTANT: After Making Changes

**Always run `git acp -m "your message"` after every set of edits to update deployment before ending agent response.**

### Environment Variables

**Local (`.env.local`):**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (recommended): Bypasses RLS for daily-learn API; if unset, falls back to anon (subject to RLS)
- `TMR_ADMIN_SECRET` (optional): secret for `/admin/tmr` and `GET /api/tmr/admin/entries`
- `DAILY_LEARN_ADMIN_SECRET` (optional): required for `GET /api/daily-learn/admin/keys`; if unset, endpoint returns 401

**Production (Vercel):**

- Same variables configured in Vercel dashboard
- `CLEANUP_API_KEY` (optional, for cleanup endpoint)

### E2E Testing

- **Playwright** in `e2e/` — tests in `e2e/*.spec.ts`
- **Coverage**: Home, navigation (all games + theme2), Game24 (practice), Jeopardy, Poker, TMR, Chwazi, Daily-log, Pear Navigator, Mental Obstacle Course, party games (Quip Clash, Fib It, Enough About You), Leaderboards. **Local**: Chromium + Mobile Chrome. **`CI=1` / `npm run test:e2e:ci`**: Chromium only (faster, less memory).
- **Dev server**: Playwright starts `next dev` on **port 3001** by default (`PLAYWRIGHT_WEB_PORT`, `PLAYWRIGHT_BASE_URL` to override).
- **Agent**: Use `/e2e-reviewer` when Playwright E2E tests are needed to confirm site functionality, fix failing tests, or iterate on improvements. Prefer Composer 1.5 for interactive sessions.

### MCP Servers

- **Supabase MCP**: Database queries, migrations, project management
- **Vercel MCP**: Deployment management, project info, build logs
  - Project: `jon-fun` (prj_p0GxMYUx0l1bfSrEVJQ161WkgTFe)
  - Team: jychen04's projects

### Troubleshooting

- Changes not live? Check Vercel build logs and confirm changes are on `main`.
- Supabase issues? Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` and Vercel.
- Two Supabase projects (personal vs class)? See [docs/SUPABASE_TWO_PROJECTS.md](docs/SUPABASE_TWO_PROJECTS.md).
- Still stale? Hard refresh cache (Cmd+Shift+R).

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test:e2e` - Run Playwright E2E tests (starts dev server if needed)
- `npm run test:e2e:ci` - Same with `CI=1` (Chromium-only projects, stricter `forbidOnly`, retries)
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI

## 📝 Key Architectural Decisions

1. **No authentication** - Poker rooms use PIN-based access
2. **Session-based state** - Player identity stored in `sessionStorage`
3. **Real-time updates** - Supabase Realtime subscriptions for multiplayer
4. **Automatic cleanup** - Cron job deletes inactive rooms after 24 hours
5. **Optimized performance** - Memoization, parallel operations, minimal re-renders
6. **Type safety** - Strict TypeScript, no `any` types
7. **Minimal documentation** - Personal project, code should be self-explanatory

## 📜 Changelog

Running log of project work. Update this section when making significant changes. Format: **YYYY-MM**: Short description.

**2026-03**

**2026-04**

- **OpenClaw local-only channel cleanup (ops)**: Removed email/cloud bridge settings from active OpenClaw runtime by dropping `hooks` and `channels.telegram` from `~/.openclaw/openclaw.json`; retained only BlueBubbles (iMessage) + WhatsApp channels. Tightened BlueBubbles allowlists to self-number thread identifiers only to prevent unintended chat activation.
- **OpenClaw env local simplification (ops)**: Reduced `openclaw-hybrid/config/env.cloud` to local essentials only (`OPENCLAW_*`, `OPENROUTER_API_KEY`, `BLUEBUBBLES_*`), removing Outlook Graph, Power Automate, bridge relay, Telegram fallback, and Twilio escalation variables.
- **OpenClaw capability stack upgrade (ops)**: Switched BlueBubbles endpoint to `https://marina-character-arms-normal.trycloudflare.com` in `~/.openclaw/openclaw.json` and `openclaw-hybrid/config/env.cloud`; re-hardened BlueBubbles ingress to email-thread allowlist (`jonathanchenyiran@gmail.com`) with groups disabled; explicitly enabled browser plugin entry.
- **OpenClaw skill/workflow expansion (ops)**: Installed ClawHub skills `research-agent` and `memory-setup-openclaw`, and added local skills under `~/.openclaw/workspace/skills/` for `style-mirroring`, `web-research-lite`, and `clawflow-ops` to enforce concise style matching, source-grounded web research, and structured multi-step execution.
- **OpenClaw memory provider repair (ops)**: Upgraded CLI to `OpenClaw 2026.4.2`, installed missing `node-llama-cpp`, and initialized local embedding model so `memory_search` is fully ready (`Provider: local`, vector index healthy) for durable recall and memory hygiene workflows.
- **OpenClaw weather reliability fix (ops)**: Added deterministic weather helper script at `~/.openclaw/.openclaw/workspace/weather-now.py` (Open-Meteo via `curl` + Python parsing) and updated `SOUL.md` weather handling to use `exec` first, then `web_fetch` fallback, so weather responses no longer depend on flaky model/tool routing.
- **OpenClaw web tool cost hardening (ops)**: Disabled paid `tools.web.search.enabled` and tuned `tools.web.fetch` (`timeoutSeconds`, `maxChars`, `readability`) in `~/.openclaw/openclaw.json` to reduce 402 credit-limit failures and keep weather/network calls deterministic.

- **OpenClaw WhatsApp outbound hardening (ops)**: Locked outbound messaging scope to prevent cross-thread/cross-provider sends by setting `tools.message.allowCrossContextSend=false`, `tools.message.crossContext.allowWithinProvider=false`, `tools.message.crossContext.allowAcrossProviders=false`, and `tools.message.broadcast.enabled=false`; disabled `channels.whatsapp.configWrites` to prevent runtime target rewrites; retained WhatsApp allowlist and default target on `+14156915618`.
- **OpenClaw control + approvals tuning (ops)**: Updated `~/.openclaw/openclaw.json` to make WhatsApp the explicit control thread (`channels.whatsapp.defaultTo=+14156915618`, `dmPolicy=allowlist`, `allowFrom=[+14156915618]`) and enabled `channels.whatsapp.configWrites=true` so in-chat control-thread updates can persist. Updated local exec approval allowlist to wildcard (`*`) for maximum command autonomy and reduced repeated approval prompts.
- **OpenClaw hybrid automation kit (new)**: Added end-to-end implementation scaffolding under `docs/openclaw-hybrid/`, `openclaw-hybrid/`, and `scripts/openclaw-hybrid/` for cloud-hosted OpenClaw orchestration + Mac BlueBubbles iMessage transport + Outlook (Power Automate + Microsoft Graph) approval bridge, important-email alerting with iMessage primary + Telegram fallback, risk/style policy templates, systemd units, bootstrap/health/smoke scripts, and cost/operations runbooks.
- **Party games (Quip Clash, Fib It, Enough About You)**: Shared Supabase schema (`supabase-migration-party-games.sql`), APIs under `/api/party/*`, client in `src/components/party/` + `src/lib/party/`; routes `/games/quip-clash`, `/games/fib-it`, `/games/enough-about-you` + Theme 2 mirrors; home cards; `PageShell` card-page paths; cleanup cron includes `party_rooms`; Playwright navigation entries; client `partyFetch` + 25s timeout; `data-testid` `party-room-pin` / `party-error`.
- **E2E (party)**: `e2e/party-games.spec.ts` runs **serial** with lobby scoped to first `aside`; create/join assertions use `expect.poll` for pin or error; Fib It **← Home** waits for lobby **Create** enabled then `waitForURL('/')` + click to avoid hydration flake; removed invalid `maxFailures: 0` from Playwright config.
- **Mental Obstacle Course**: New game at `/games/mental-obstacle-course` (Theme 2 mirror under `/theme2/games/mental-obstacle-course`) — six sequential rounds (Speed, Numbers, Logic, Working memory, Words, Knowledge) with SVG radar chart, course score, localStorage history + personal best; non-clinical copy throughout; home cards + `PageShell` card-page styling; e2e navigation entry.
- **E2E (Mental Obstacle + shell)**: `?mocE2e=1` shortens timers and exposes `data-testid` hooks for Playwright; `e2e/mental-obstacle-course.spec.ts` (desktop full run + mobile tap/trivia + theme query preservation); `e2e/helpers/moc.ts` (`mocStartFromIntro` waits for **Continue** enabled after client mount); `PageShell` preserves query string on Theme 2 / Main switch; theme switcher moves to **top-right** on mental-obstacle routes so it does not cover bottom controls; root `layout` wraps `PageShell` in `Suspense` for `useSearchParams`. Specs use `domcontentloaded` + longer reaction waits for cold `next dev`; Playwright dev server on **port 3001** by default (`PLAYWRIGHT_WEB_PORT`), `webServer.timeout` 180s.
- **Mental Obstacle Course UX**: Intro **Continue** stays `disabled` until `useEffect` runs so first tap always hits a hydrated handler (fixes flaky Playwright when `next dev` compiles mid-run).
- **E2E stability hardening (party + home)**: `GameCard` “Coming Soon” waits for client mount before enabling click; party lobbies (Quip Clash, Fib It, Enough About You) gate Create/Join on `clientReady`; party E2E helper uses mobile `tap()` + waits for enabled buttons; warmup API call is best-effort. `playwright.config.ts` now uses a low default worker count (`PLAYWRIGHT_WORKERS`, default `1`) to avoid `next dev` worker SIGKILL/OOM crashes.
- **Mental Obstacle Course balancing + pacing update**: Every domain now has a **preview/demo gate** with `Start` (or `Enter/Return`) and timers begin only after that start action. Difficulty raised (while leaving the first speed/reaction obstacle behavior unchanged): arithmetic now uses larger operands plus mixed-order expressions, arithmetic scoring is stricter on accuracy, pattern sequences are more varied with tighter distractors, working-memory starts at 4 digits and scales to 10, trivia bank replaced with harder multi-domain questions, tap-word targets are longer, and MOC Playwright flow starts each round from preview.
- **Build / types / lint**: `FibRound` includes optional `picker_player_id` (Fibbage UI); Quiplash sync state uses `[, setVotes]` / `[, setFinalVotes]` to satisfy `no-unused-vars`; EAY (Enough About You) API loop drops unused `fooled` counter.
- **README — Core design principles**: Product, UX, visual tone, `PageShell` / home-link behavior, and local-first + optional Supabase sync documented in-repo (principles centralized in README; `DESIGN-SYSTEM.md` remains token/palette reference).
- **Chwazi mobile Home**: Shell header gets `z-50` above the full-screen touch layer; touch handlers skip `preventDefault` on link targets; in-game ← Home uses correct Theme 2 href and a larger tap target.
- **Deploy fix**: `playwright.config.ts` no longer sets `workers: undefined` (incompatible with `exactOptionalPropertyTypes` during `next build` typecheck).
- **Theme 1 readability**: Notebook root scale ~106.25% (half of prior bump), Patrick Hand ~1.225rem / ~0.043em tracking; Pear Navigator URLs still skip root scale. Game 24: only `.card-number` scales up on Theme 1 (tile/grid CSS unchanged); main line-paper pages use same `pt-[30px] pb-8` as home; Game 24 shell padding tighter on Main. Home game card titles `font-bold`.
- **Pear Navigator on main home**: Card removed from `/` grid; entry preserved in `src/data/notebook-home-games-archive.ts` for restore. `/games/pear-navigator` and Theme 2 home unchanged.
- **E2E testing**: Full Playwright suite across home, navigation, Game24, Jeopardy, Poker, TMR, Chwazi, Daily-log, Pear Navigator, Leaderboards. `e2e-reviewer` agent for verification/iteration.
- **Texas Hold'em room fixes**: Actions API now advances action_on to next player after each action; pot_main updated when players bet; game start assigns 100 BB starting chips and posts blinds; hand complete (action_on -1) shows showdown message.
- **1 Sentence Everyday draft preservation**: Periodic sync (60s) no longer overwrites unsaved draft; todayText only updated from storage when empty (initial load) or when it matches stored value (post-save).
- **Theme2 header standardized**: All theme2 pages (except Pear Navigator, Chwazi mobile, Poker lobby/table) use same header (px-4 py-3 md:py-4, logo text-3xl md:text-4xl); own-theme pages keep compact header; documented in DESIGN-SYSTEM.md.
- **Theme switch + header + cards**: Theme switch fixed bottom-right on all pages (theme1 and theme2); main-theme header shorter (py-3 md:py-4, min-h-80px); notebook home cards use compact size (gap-6, p-6) to match theme2.
- **Chwazi mobile own-theme**: Chwazi on mobile (≤767px) always uses theme2 styling (pre-notebook look); fullBleed layout; theme switch hidden. Chwazi mobile and Pear Navigator always have their own theme—documented in Design System.
- **Theme switch preserves path**: Theme 2 / Main links now switch theme but stay on same page (e.g. /games/tmr ↔ /theme2/games/tmr); added theme2 pear-navigator/results route
- **Pear Navigator variant B demo content**: When variant B (Next step flow), auto-show example text on business card (Alex Chen, Product Designer, alex@studio.co) and example paint strokes (blue + yellow) on canvas to demonstrate capability
- **Pear Navigator A/B variant tracking**: variantRef ensures variant is always available for sendProgress/visibility beacon; assignment at Start; validated in sessions/results APIs
- **Pear Navigator feedback flow**: 1s delay before feedback popup; popup closes on answer so user sees final product; guide panel shows Start over / Go home after rating
- **Pear Navigator variant B UX**: Red ring highlight on Next step button so users know to tap it; guide text "Do the action in the mock, then tap Next step ↓"; wrong-tap toast variant-aware
- **Theme swap**: Notebook is now default at `/`; Ink & Paper moved to `/theme2`. Brighter cream palette; lighter line paper (0.02); home grid `gap-y-[30px]` and `pt-[30px]` for line alignment with cards. Redirect `/notebook` → `/`.
- **Pear Navigator A/B results page**: `/games/pear-navigator/results`—statistical tests (χ² completion, t-test time, χ² ratings); step-level tracking + dropouts; stratified by task; migrations `supabase-migration-pear-navigator-ab.sql` + `supabase-migration-pear-navigator-sessions.sql`; sessions API for progress/dropout
- **Pear Navigator A/B testing**: On task select, random A or B. A: same flow, no skip button. B: fixed Next step button, must press to advance (mock taps no-op). Post-task: Meh/Good/Great feedback + total/avg time; logs to console
- **Pear Navigator mindmap PM terms + buttons**: PM terms (OKR, KPI, etc.) only after pressing See example—use mmHasSeenExample state instead of stepIdx; Fill and See example buttons always visible; all business card buttons (Template, Background, Accent, Text, Rectangle) always visible; handlers advance only when at correct step
- **Pear Navigator mindmap fill vs See example**: Fill step now only applies color—keeps "Idea A/B/C" labels; PM terms (OKR, KPI, etc.) appear only after pressing "See example"
- **Pear Navigator business card export**: Export-as-image (PNG/JPG) for business card—same flow as painting: settings gear opens dropdown, choose format to download; html2canvas for DOM capture; 2 new steps (Open export menu, Save your card)
- **Notebook consistency pass**: Notebook doodles everywhere (leaderboards, jeopardy, chwazi, TMR); inner boxes use `bg-transparent` so fixed line paper aligns; TMRManager, DailyLearnManager, Admin TMR notebook-aware; Stanford-ish red accent (#8c3838)
- **Notebook theme** (`/notebook`): Alternate path—Patrick Hand font (readable handwritten), 1.2rem base, creamier palette, Stanford-ish red accent, doodly icons; single fixed line paper; Notebook/Main nav links
- **Pear Navigator mobile touch fix**: stopPropagation + onTouchEnd preventDefault on HotspotButton to fix dropdown taps bubbling to parent (wrong-tap toast); 44px min touch targets for dropdown options
- **Pear Navigator guide panel compact**: Smaller text, padding, and buttons on narrow/tall screens; taller panel (16–24vh) so more fits with minimal/no scroll
- **Pear Navigator responsive fill**: Mock now fills container via flex (no fixed scaling); no whitespace, no cutoff; export dropdown only after settings tap
- **1 Sentence Everyday**: Sync on visibility (immediate when tab visible again); 60s interval when visible, 1hr when hidden
- **Pear Navigator mobile viewport pass**: Reduced full-bleed header height on game pages, removed extra safe-area padding from PearNavigator chrome, tightened mobile guide panel max-height (11–16vh), reduced simulator bezel/insets on small screens, lowered scale floor (`0.32`) to prevent mock cutout on narrow/tall devices, and added `scrollbar-needed` utility for overflow-only scrollbar rendering with stable gutter.
- **Pear Navigator editor density**: Filled simulator space by increasing mock design size (`700x520`), compacting hotspot control heights, and switching forced `overflow-y-scroll` panels to `overflow-y-auto` so sidebars only scroll when truly needed and controls fit more naturally.

**2025-03**

- **1 Sentence Everyday**: Visibility-aware sync – 60s when tab visible, 1hr when hidden; sync on visibility (user returns to tab) to reduce server load
- **1 Sentence Everyday**: Sync-failed alert – prominent banner on all views when saves to Supabase fail; initial + periodic sync set syncFailed; banner persists until retry succeeds
- **Pear Navigator responsive**: Mobile/iPhone, narrow & wide laptop—min-h-dynamic (100dvh), safe-area toast, 44px touch targets, guide max-h so demo fits; docs/RESPONSIVE-BEST-PRACTICES.md
- **Pear Navigator mobile fix**: PageShell fullBleed uses h-dynamic + flex so main gets viewport height; PearNavigator flex-1 fills; simulator no longer collapses to black empty space on iPhone
- **Pear Navigator mobile polish**: overflow-y-hidden prevents scroll past content; step box 28–38vh so simulator dominates; compact step UI, scrollbar-visible on guide/mock; narrower mock panels, smaller frame border on mobile
- **Pear Navigator mobile v2**: body overflow hidden on fullBleed (fixes bottom whitespace); scrollbar-visible uses overflow-y:scroll so scrollbars stay visible; guide 18–26vh (simulator much taller); MockScaleWrapper scales mock to fit; compact step UI
- **Pear Navigator audit fix**: MockScaleWrapper uses layout size w×h (scaled) so mock fits without cutout; guide 16–24vh; scale min 0.5 guard
- **1 Sentence Everyday**: Supabase sync on every load (push local to server); migration `supabase-migration-daily-learn.sql` for `daily_learn_entries` table
- **Subagents**: Removed heavy-lift; kept think-hard as sole context-heavy subagent
- **Doodle icons**: Added `public/doodles/`—hand-drawn SVG icons (tmr, daily, pear, game24, jeopardy, chwazi, leaderboards, coming-soon, poker). Replaced emojis in GameCard, TMR header, leaderboards, jeopardy, Coming Soon modal. Texas Hold'em uses doodle-style poker.svg (card + spade).
- **docs/DESIGN-SYSTEM.md**: Canonical design system doc for agents—palette, typography, guidelines
- **Palette & home**: Cream background (#faf6f0), burgundy accent (#800020), taupe muted; removed header border on home; 24 Game → 24 (Jon's favorite)
- **Layout fix**: PearNavigator and Poker lobby/table use full-bleed (no max-w constraint) to prevent horizontal overflow and left whitespace; PearNavigator w-screen→w-full; overflow-x-hidden on html/body and PageShell
- **UX polish**: sfjc.dev bigger centered on homepage; all emojis replaced with doodle SVGs (tmr, daily, pear, game24, jeopardy, chwazi, leaderboards, coming-soon, study, sleep, history, info); touch targets ≥44px (Game24 reset, Poker Update, Daily-log month nav, Jeopardy overlay); removed duplicate Pear ← Home; img→Image for doodles
- **UI Phase 4 (Ink & Paper)**: Focus-visible rings on PageShell links and GameCard for accessibility
- **UI Phase 3 (Ink & Paper)**: All game pages converted to Ink & Paper—cream bg, ink tokens, paper cards. Daily-log, TMR, 24, Jeopardy, Chwazi gate, poker landing, admin/tmr. Game24: ink-style number cards and operators (muted tones). Poker lobby/table and Pear Navigator inner keep their themes (green felt, dark). Removed duplicate "← Home" where PageShell provides it.
- **UI Phase 2 (Ink & Paper)**: GameCard extracted to components/GameCard.tsx (paper card, ink text, translateY hover); Home redesigned—flat grid, no gradient/duplicate header, minimal Coming Soon modal (bg-black/40 overlay); Leaderboards Ink & Paper
- **UI Phase 1 (Ink & Paper)**: Design system in globals.css (--ink-* vars, Lora + Charter); PageShell component (sfjc.dev header, back link on subpages); root layout wraps all pages; Tailwind @theme for ink colors/fonts
- **docs/Website-Themes-Reference.md**: Added Theme 7 (Developer Logical), image examples for Monolith, Ink & Paper, Charcoal Statement, Bone & Black, Developer Logical in `docs/theme-examples/`
- **1 Sentence Everyday**: Use service role key for daily-learn API (bypasses RLS); fallback to anon if unset
- **1 Sentence Everyday**: Reliable sync—3x retry on push, await save before "Saved", periodic sync every 60s, "Sync failed" feedback
- **1 Sentence Everyday**: Fix RLS on daily_learn_entries—add policies for anon SELECT/INSERT/UPDATE/DELETE (was blocking restore)
- **1 Sentence Everyday**: Remove admin key / List keys UI from Sync page
- **1 Sentence Everyday**: Cmd+Enter to submit; Esc to cancel/leave textarea (today box blurs; edit modal closes)
- **Pear Navigator**: Mock tools kept complex/jargony (Brush Library, Dynamics, Instance, Auto layout, Fill) to show overlay value; Business card first; designer mindmap (Brand, Components); 3 connector taps
- **think-hard subagent**: `.cursor/agents/think-hard.md` — Cursor subagent for research, exploration, parallel analyses, critiques; one task per invocation to keep main context clean
- **Pear Navigator business card**: Template dropdown first (Minimal, Classic, Modern); separate fill dropdowns for background + accent; Text adds textbox per step—overlay prompts name/role/email with Done
- **Pear Navigator mindmap**: Instances and connectors start overlapping; Layout step spreads instances; Auto layout spreads connectors; Fill outer/inner dropdowns (Blue, Teal, Rose, etc.); See example as final step populates PM terms (OKR, KPI, etc.)
- **Sports-talent-research**: Evidence backup table mapping key claims (genetic testing, physical test validity, force plates) to peer-reviewed sources
- **docs/MS&E165-Metrics-Sources.md**: Sources for Pear Navigator GTM metrics (retention, adoption, Copilot benchmarks)
- **1 Sentence Everyday**: Remove personal sync key from restore banner; generic "enter your sync key" for all users
- **Pear Navigator**: Replace Figma variants demo with "Design a business card"—6 steps (frame, fill, name, role, email, accent); elegant dark gradient card with amber accent
- **Pear Navigator painting demo**: Rename task to "Your first painting!"; remove sky references (Layer, Blended, pear-painting.png); 1 blue stroke; direction text emphasizes mix/overlap blue+yellow to see blending
- **Pear Navigator UX overhaul**: Larger demo window (max-w-6xl), mindmap-first task order; bigger buttons/text; Paint sky: yellow step + red highlight, blue-then-yellow phases; real dropdowns for blend (Procreate), swap (Figma Variants), export format (PNG/PSD/Procreate); step audit: removed opacity + Pick accent steps, mindmap 9→5 instance steps, merged connector/spacing steps; workflow fixes: swap order Hover→Pressed→Default for visible change, mindmap hints (one tap = batch), State property visible after Add property
- **Pear Navigator**: Keep 3 demos (Paint textured sky, Component variants, Mindmap); remove Brush and Notion; paint step: red highlight, explicit blue-then-yellow prompt, no faded example; mindmap instances offset from center for visible connectors
- **Pear Navigator demo polish**: Tap-to-advance; wrong-tap toast; Previous step; PearPad frame; Notion table/board/filter; Figma Variants swap effect; Procreate Brush test step; Paint sky: 3-stroke min, gradient bg, layer blend indicator, export menu; Mindmap: connectors per instance, Layers panel
- **docs/MS&E165-GTM-and-Resources-Slides.md**: Slide content for GTM Strategy and Required Resources (channels, metrics, post-launch impact; funding, tools, team, partnerships with how each supports launch) aligned to MS&E 165 rubric

**2025-02**

- **ESLint**: Fix Next.js plugin detection (explicit @next/next plugin; adjust ignores); deps: Next 15.5.12, React 19.2.4, @supabase/ssr 0.8
- **1 Sentence Everyday**: Restore from server (Sync tab) after clearing site data; 5am reset device local
- **Favicon**: Calligraphic J (PNG, transparent background); restore prompt when no entries
- **gh-git-github-workflow skill**: Cursor skill for git/gh CLI (repos, PRs, issues, wiki clone/edit, full command ref); consolidated into single SKILL.md
- **1 Sentence Everyday**: Inline calendar + history on main page; "(Resets 5am)"; renamed; fixed date display; edit previous entries; month nav; Supabase sync
- **Game24**: Broadcast on start/solve for instant sync; 500ms polling fallback; fix button blink; click-deselect; final rankings show correct/total
- **Chwazi**: Touchscreen-only
- **Home**: TMR + 1 Sentence top 2 cards; uniform card height; "← Home" standardized
- **TMR**: Brain emoji → speaker (🔊) on page title and game chip; removed Run on Web info box
- **Pear Navigator**: PearPad-only; 5 tasks (Procreate brush, Paint textured sky, Notion DB, Figma variants, Create mindmap); removed Photoshop/Lightroom; robust overlay + 44px touch targets for demo video (MS&E 165)
- **Pear Navigator**: Drill-down options when buttons pressed; active ring + checkmarks; stronger press feedback
- **Pear Navigator**: Paint textured sky (10 steps)—color picker, layers, canvas stroke, blend mode, export; Create mindmap (15 steps)—central frame, text, component, 9 instances (Idea A–I), connectors, auto layout, Fill with PM example; fixed step thresholds, hints, larger Fill layout
- **Pear Navigator mindmap**: Radial layout for Idea nodes (even spacing); Auto layout tightens radius only (no structure change); Fill keeps same 1-center+9-nodes format, replaces text with PM terms (OKR, KPI, Agile, etc.)
- **Pear Navigator**: Cluttered mock UIs (Figma, Procreate, Notion) with extra labeled design-tool buttons to show how guidance cuts through typical UI noise; standardized hotspot/clutter styling and button labels (e.g. Fill example)
- **docs/MVP-Feedback-Evolution.md**: PM-style feedback narrative (simulated user testing, A/B) mapping MVP to improvements; rubric structure for MS&E 165
- **Pear Navigator Paint textured sky**: Interactive brush—blue and yellow brushes; paint on canvas; first stroke advances step
- **Pear Navigator mindmap**: Fanned stack (offset nodes) before Auto layout; sky two-layer paint (blue/yellow) + Blend button applies overlay blend

## 📋 README Maintenance Guidelines

**For AI Agents**: When making changes to the project, update this README if: adding a game, DB tables/columns, API routes, architectural changes, or tech stack changes. Add entries to the Changelog section above for significant changes. **Product and UX:** Follow **Core design principles** in this README (audience, minimal UI, flat nav, `PageShell` behavior, local-first + optional sync). **Visual tokens / palette:** [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) + `globals.css`—keep them in sync when colors or typography change.

**Deployments (sfjc.dev on Vercel):** After `git add` / `commit` / `push`, the agent should confirm the Vercel deployment succeeds (e.g. run `npm run build` locally to match CI, and check the latest deployment in the Vercel dashboard or `vercel` CLI). If the deployment fails, diagnose and fix the build (or config) before stopping—not only push and assume green.

**Keep it concise**:

- 🔄 **Replace/update** existing sections rather than adding new ones
- 🗑️ **Remove outdated** information when updating
- ❌ **Don't document** implementation details that change frequently
- ❌ **Don't add** temporary fixes or workarounds
- 📏 **Target length**: Keep under 250 lines total

**When updating**: Modify the relevant section in-place, don't append new sections unless truly necessary.
