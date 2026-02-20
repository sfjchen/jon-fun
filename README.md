# Jon-fun - Game Hub

A personal collection of fun games built with Next.js, TypeScript, and Supabase. Deployed at [sfjc.dev](https://sfjc.dev).

## 🎮 Games

- **24 Game** (`/games/24`): Use 4 numbers and basic arithmetic to make 24
- **Jeopardy with Friends** (`/games/jeopardy`): Create and play custom Jeopardy boards locally
- **Texas Hold'em** (`/games/poker`): Poker chip tracker with real-time multiplayer lobbies
- **Chwazi Finger Chooser** (`/games/chwazi`): Place fingers on screen to randomly select a winner
- **TMR System** (`/games/tmr`): Targeted Memory Reactivation for learning and sleep
- **1 Sentence Everyday** (`/games/daily-log`): One sentence per day, history, calendar, export, cross-device sync (localStorage + Supabase)
- **Pear Navigator** (`/games/pear-navigator`): PearPad tablet simulator—Procreate, Notion, Figma guides; tap UI elements to advance; MS&E 165 demo

## 🚀 Quick Start

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

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
│   │   └── pear-navigator/
│   ├── leaderboards/       # Leaderboards page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page
├── components/             # React components
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
│   └── PearNavigator.tsx
└── lib/                    # Utility libraries
    ├── supabase.ts         # Supabase client
    ├── poker.ts            # Poker types & utilities
    ├── jeopardy.ts         # Jeopardy types & utilities
    ├── tmr.ts              # TMR config & session storage
    ├── dailyLearn.ts       # 1 Sentence Everyday (localStorage)
    └── solver24.ts         # 24 Game solver algorithm
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

- Deletes rooms inactive >24 hours
- Requires `CLEANUP_API_KEY` env var (optional)

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
- `TMR_ADMIN_SECRET` (optional): secret for `/admin/tmr` and `GET /api/tmr/admin/entries`

**Production (Vercel):**

- Same variables configured in Vercel dashboard
- `CLEANUP_API_KEY` (optional, for cleanup endpoint)

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

**2025-02**

- **1 Sentence Everyday**: Restore from server (Sync tab) after clearing site data; 5am reset device local
- **Favicon**: Heavy-slant calligraphic J; restore prompt when no entries
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

## 📋 README Maintenance Guidelines

**For AI Agents**: When making changes to the project, update this README if: adding a game, DB tables/columns, API routes, architectural changes, or tech stack changes. Add entries to the Changelog section above for significant changes.

**Keep it concise**:

- 🔄 **Replace/update** existing sections rather than adding new ones
- 🗑️ **Remove outdated** information when updating
- ❌ **Don't document** implementation details that change frequently
- ❌ **Don't add** temporary fixes or workarounds
- 📏 **Target length**: Keep under 250 lines total

**When updating**: Modify the relevant section in-place, don't append new sections unless truly necessary.
