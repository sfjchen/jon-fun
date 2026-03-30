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

## 🚀 Quick Start

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

## 🎨 Design System

**Theme:** Ink & Paper (cream + burgundy). See **[docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)** for color palette, typography, and guidelines. Use `var(--ink-*)` tokens from `globals.css`. Game-specific themes: Poker (green felt), Pear Navigator (dark). **Default theme** (notebook) at `/`—brighter cream, Patrick Hand, line paper. **Theme 2** (Ink & Paper) at `/theme2`—burgundy accent, Lora/Charter. **Own-theme pages:** Chwazi mobile and Pear Navigator always use their own theme (no notebook styling); theme switch hidden on Chwazi mobile. These pages use compact header; all other theme2 pages use standardized header (see docs/DESIGN-SYSTEM.md).

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
│   │   └── pear-navigator/
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
- **Coverage**: Home, navigation (all games + theme2), Game24 (practice), Jeopardy, Poker, TMR, Chwazi, Daily-log, Pear Navigator, Leaderboards. Chromium + Mobile Chrome.
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

- **Theme 1 readability**: `html.notebook-theme-root` scales root `rem` (~112.5%) plus wider letter-spacing; notebook shell inherits slightly larger Patrick Hand size. Game 24 number tiles much larger on Theme 1 only.
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

**For AI Agents**: When making changes to the project, update this README if: adding a game, DB tables/columns, API routes, architectural changes, or tech stack changes. Add entries to the Changelog section above for significant changes. **For UI/theme changes:** Consult [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) and keep palette/guidelines in sync.

**Keep it concise**:

- 🔄 **Replace/update** existing sections rather than adding new ones
- 🗑️ **Remove outdated** information when updating
- ❌ **Don't document** implementation details that change frequently
- ❌ **Don't add** temporary fixes or workarounds
- 📏 **Target length**: Keep under 250 lines total

**When updating**: Modify the relevant section in-place, don't append new sections unless truly necessary.
