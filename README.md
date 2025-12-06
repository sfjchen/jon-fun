# Jon-fun - Game Hub

A personal collection of fun brain games built with Next.js, TypeScript, and Supabase. Deployed at [sfjc.dev](https://sfjc.dev).

## 🎮 Games

- **24 Game** (`/games/24`): Use 4 numbers and basic arithmetic to make 24
- **Jeopardy with Friends** (`/games/jeopardy`): Create and play custom Jeopardy boards locally
- **Texas Hold'em** (`/games/poker`): Poker chip tracker with real-time multiplayer lobbies
- **Chwazi Finger Chooser** (`/games/chwazi`): Place fingers on screen to randomly select a winner

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
│   │   └── chwazi/
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
│   └── PokerJoinForm.tsx
└── lib/                    # Utility libraries
    ├── supabase.ts         # Supabase client
    ├── poker.ts            # Poker types & utilities
    ├── jeopardy.ts         # Jeopardy types & utilities
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

### Indexes
- `idx_poker_rooms_last_activity` on `poker_rooms(last_activity)` for cleanup queries

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
- **Use `git acp -m "message"`** to commit and push
  - This alias does: `git add . && git commit -m "message" && git push`
- **Vercel auto-deploys** on push to main (1-3 minutes)

### ⚠️ IMPORTANT: After Making Changes
**Always run `git acp -m "your message"` at the end of each prompt/session to update deployment.**

### Environment Variables

**Local (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Production (Vercel):**
- Same variables configured in Vercel dashboard
- `CLEANUP_API_KEY` (optional, for cleanup endpoint)

### MCP Servers
- **Supabase MCP**: Database queries, migrations, project management
- **Vercel MCP**: Deployment management, project info, build logs
  - Project: `jon-fun` (prj_p0GxMYUx0l1bfSrEVJQ161WkgTFe)
  - Team: jochen2sfusd's projects

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

## 🐛 Troubleshooting

**Changes not appearing on sfjc.dev?**
1. Check Vercel dashboard for deployment status
2. Verify changes are on main branch: `git log origin/main --oneline -5`
3. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)

**Supabase connection issues?**
1. Verify environment variables are set correctly
2. Check Supabase project is active
3. Ensure Realtime is enabled for tables in Supabase dashboard

**Build failures?**
1. Run `npm run build` locally
2. Review Vercel build logs
3. Ensure all dependencies are in `package.json`

## 📄 License

MIT License
