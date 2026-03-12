# UI Overhaul Plan: Ink & Paper Theme

## Executive Summary

**Goals:** Rebrand Jon-fun Game Hub (sfjc.dev) from the current purple-gradient, glassmorphism aesthetic to the Ink & Paper theme—cream background, ink typography, editorial clarity—with restrained handwritten/doodle character where it enhances without overwhelming.

**Constraints:** Preserve all functionality; game-specific UIs (Poker green felt, Pear Navigator dark tablet simulator) may retain thematic divergence where justified; avoid Inter, Roboto, purple gradients; maintain VC-style elegance.

**Rollback strategy:** Create git branch `pre-ink-paper-overhaul` (or tag `pre-ink-paper-overhaul`) before any code changes. Document revert steps in Appendix.

---

## Current State Analysis

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Home—game grid, Coming Soon modal |
| `/games/24` | 24 Game (math puzzle) |
| `/games/jeopardy` | Jeopardy with Friends (create/play boards) |
| `/games/poker` | Texas Hold'em (create/join rooms) |
| `/games/poker/lobby/[pin]` | Poker lobby |
| `/games/poker/table/[pin]` | Poker table |
| `/games/chwazi` | Chwazi Finger Chooser (touch-only) |
| `/games/tmr` | TMR System (study/sleep sessions) |
| `/games/daily-log` | 1 Sentence Everyday |
| `/games/pear-navigator` | Pear Navigator (Procreate/Figma demo) |
| `/leaderboards` | Leaderboards (Coming Soon) |
| `/admin/tmr` | TMR admin |

### Design Patterns

- **Background:** `bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900` on home, leaderboards, 24, jeopardy, chwazi, tmr, daily-log, admin. Poker uses green gradient; Pear Navigator uses dark charcoal.
- **Typography:** Inter (globals.css), no heading/body distinction.
- **Cards:** `bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20`—glassmorphism throughout.
- **CTAs:** `bg-blue-600 hover:bg-blue-700`; purple for secondary in Game24.
- **Navigation:** No shared nav. Each page has inline `← Home` link; layout varies (centered header vs flex justify-between).

### Components

- **GameCard:** Inline in `page.tsx`. Emoji or `/poker-table.svg` icon, title, description, "Click to play →". Hover scale 1.05.
- **Game pages:** Thin wrappers; logic lives in components (Game24, JeopardyEditor, PokerLobby, etc.). Each component owns its full-page layout and back link.
- **globals.css:** Inter, `.header-section` (blue-800), `.game-card` / `.operator-btn` / `.action-btn` for 24 Game, animations (pulse, cardFlip, etc.).

### Pain Points

1. **Inconsistent nav:** No persistent shell; back links duplicated across 10+ files.
2. **Theme mismatch:** Purple gradient explicitly avoided in design guidelines; current look is generic startup/AI-generated.
3. **No information hierarchy:** Flat grid; personal tools (TMR, daily-log) mixed with social games (24, poker) and demo (Pear Navigator).
4. **Heavy glassmorphism:** Works on dark; will not translate to cream/paper aesthetic.
5. **Game-specific globals:** `.game-card`, `.operator-btn` in globals.css are 24-specific; pollute global namespace.

---

## Design System: Ink & Paper

### Color Palette (hex)

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink-bg` | `#faf8f5` | Page background (cream) |
| `--ink-text` | `#1a1a1a` | Primary text |
| `--ink-muted` | `#6b6b6b` | Secondary text, captions |
| `--ink-accent` | `#2563eb` | Links, CTAs, highlights |
| `--ink-border` | `#e5e2de` | Dividers, card borders |
| `--ink-paper` | `#f5f3ef` | Slightly darker paper for cards/sections |

### Typography

| Role | Font | Sizes | Weight |
|------|------|-------|--------|
| Heading 1 | Lora | 2.5rem / 40px | 600 |
| Heading 2 | Lora | 1.75rem / 28px | 600 |
| Heading 3 | Lora | 1.25rem / 20px | 600 |
| Body | Charter | 1rem / 16px | 400 |
| Small | Charter | 0.875rem / 14px | 400 |

Import Lora (400, 600) and Charter (400) from Google Fonts. Line-height: 1.5 body, 1.2 headings.

### Spacing Scale

- Base: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Content max-width: ~65ch (≈42rem) for prose; game grids may extend to 72rem.

### Component Tokens

- **Card:** `bg-[var(--ink-paper)]`, `border border-[var(--ink-border)]`, `rounded-lg` (8px), subtle shadow `0 1px 3px rgba(0,0,0,0.06)`.
- **Button primary:** `bg-[var(--ink-accent)]`, `text-white`, hover darken 5%.
- **Button secondary:** `border border-[var(--ink-border)]`, `text-[var(--ink-text)]`, hover `bg-[var(--ink-paper)]`.
- **Link:** `text-[var(--ink-accent)]` with `underline` or `underline-offset-2`; hover slight darken.

### Handwritten / Doodle Accents (Restraint Guidelines)

| Element | Accent | Restraint |
|---------|--------|-----------|
| Section dividers | Hand-drawn rule (SVG path, ink bleed) | One style, reused; not every divider |
| Game icons | Small hand-drawn icon or marginalia-style sketch | Replace emoji where it fits; keep poker-table.svg if thematic |
| Underline on hover | Slight wobbly underline (CSS/SVG) | Only on primary nav links or featured game titles |
| Paper texture | Optional `background-image: url(paper-texture.svg)` at low opacity | Single subtle layer; not on every surface |
| Marginalia | Small doodle in corner of cards (e.g., tiny star, checkmark) | Max 1–2 per page; never on every card |

**Rule:** If in doubt, omit. Character should feel like a thoughtful margin note, not a sticker pack.

---

## Information Architecture

### Site Map

```
/ (Home – editorial hub)
├── /games/24
├── /games/jeopardy
├── /games/poker
│   ├── /games/poker/lobby/[pin]
│   └── /games/poker/table/[pin]
├── /games/chwazi
├── /games/tmr
├── /games/daily-log
├── /games/pear-navigator
├── /leaderboards
└── /admin/tmr (low prominence)
```

### Primary Nav (Proposed)

- **Persistent header:** Logo/wordmark "Game Hub" (or "sfjc.dev") left; right: "Games" dropdown or link, "Leaderboards", "← Home" or breadcrumb on subpages.
- **Alternative (simpler):** Logo left, "All Games" + "Leaderboards" as text links; no dropdown. "← Home" remains for deep pages.

### Secondary Nav

- None for now. Games are discovered from home grid. Leaderboards is a top-level destination.

### Home Structure (Editorial Hub)

1. **Hero:** Short headline ("Games & tools for learning and play"), subline. No Features→Pricing→Testimonials.
2. **Game discovery:** Grouped by type:
   - **Personal:** 1 Sentence Everyday, TMR System
   - **Play with others:** 24, Jeopardy, Poker, Chwazi
   - **Demo:** Pear Navigator
   - **Coming Soon:** Leaderboards, future games
3. **Paragraph rules** between sections (hairline or hand-drawn rule).
4. **Max-width ~65ch** for intro copy; grid can extend to ~72rem for cards.

### Game Discovery Flow

- User lands on home → sees grouped cards → clicks game → enters game.
- No search/filter initially. Grouping provides enough structure.
- "Coming Soon" card opens modal (retain behavior; restyle for Ink & Paper).

---

## Page-by-Page Plan

### Home

- **Layout:** Centered column, max-width 72rem. Cream background.
- **Content hierarchy:** H1 "Game Hub" (or site name) → tagline → grouped game grid.
- **Key elements:** GameCard redesign (paper card, ink text, accent for "Play"); Coming Soon modal (paper-style, ink borders).
- **Layout notes:** 2–3 columns grid on desktop; 1 col mobile. Generous padding.

### Game Pages (Shared Shell)

- **Layout:** Shared `GameLayout` or `PageShell` with: back link (← Games or ← Home), optional game title in header.
- **Per-game notes:**
  - **24:** Math puzzle; retain number/operator styling but adapt colors to ink/paper. `.game-card` (red) → redesign as ink-on-paper cards.
  - **Jeopardy:** Menu → Editor/Player. Adapt modal/card styling.
  - **Poker:** Thematic green felt for table/lobby is justified; landing page (create/join) uses Ink & Paper. Lobby/table can stay green.
  - **Chwazi:** Touch-only gate + full-screen game. Gate page: Ink & Paper. Game canvas: keep current playful gradient or simplify.
  - **TMR:** Multi-view (menu, study, sleep, history). Full Ink & Paper.
  - **Daily-log:** Calendar, log, export, sync. Full Ink & Paper.
  - **Pear Navigator:** Dark tablet simulator is core to demo. Keep dark theme; ensure "← Home" and chrome match site accent.
  - **Leaderboards:** Coming Soon. Ink & Paper; same card treatment as home.

### Admin (TMR)

- Low prominence. Ink & Paper; minimal. Link from TMR or footer if needed.

---

## Component Inventory & Redesign

### Components to Change

| Component | Changes |
|-----------|---------|
| `page.tsx` (Home) | Full redesign: Ink & Paper, grouped GameCards, new modal |
| `GameCard` (inline) | Extract to `components/GameCard.tsx`; paper card, ink typography, optional doodle icon |
| `leaderboards/page.tsx` | Ink & Paper shell |
| `DailyLearnManager` | Replace gradient with cream; paper cards; ink text |
| `TMRManager` | Same |
| `TMRStudySession`, `TMRSleepReactivation` | Same |
| `Game24` | Replace purple gradient with cream; redesign number cards, operator buttons for ink/paper |
| `JeopardyEditor`, `JeopardyPlayer` | Adapt to Ink & Paper (or dark if board is thematic) |
| `PokerJoinForm`, `PokerLobby`, `PokerTable` | Landing: Ink & Paper. Lobby/Table: keep green felt |
| `ChwaziGame` | Gate: Ink & Paper. Game: optional simplification |
| `PearNavigator` | Keep dark; ensure back link styling |
| `admin/tmr/page.tsx` | Ink & Paper |

### New Components

| Component | Purpose |
|----------|---------|
| `PageShell` or `AppShell` | Shared layout: header with logo, nav, back link |
| `GameCard` | Extracted, reusable |
| `InkButton`, `InkCard` | Design-system primitives (or use Tailwind + CSS vars) |
| `HandDrawnRule` | Optional SVG divider |
| `PaperTexture` | Optional background wrapper |

### Removal

- Purple/blue gradient classes from pages.
- `.header-section` if replaced by `PageShell`.
- Consider moving `.game-card`, `.operator-btn` from globals.css into `Game24.module.css` or component-scoped styles.

---

## Interaction & Motion

- **Hover:** Subtle darken on buttons (5%); card lift `translateY(-2px)` + shadow increase. No scale 1.05—too playful for editorial.
- **Transitions:** 150–200ms ease for hover/focus.
- **Micro-interactions:** Optional wobbly underline on nav link hover (CSS/SVG). No confetti, no bounce.
- **Focus:** Visible focus ring (`ring-2 ring-[var(--ink-accent)]`) for accessibility.

---

## Implementation Phases

### Phase 1: Design System + Layout Shell (Est. 1–2 days)

1. Create `pre-ink-paper-overhaul` branch.
2. Add CSS variables to `globals.css` (Ink & Paper palette).
3. Import Lora + Charter; set `font-family` in base.
4. Build `PageShell` with logo, nav, back link.
5. Add `PageShell` to root layout or per-route layout.
6. Update Tailwind theme extension (colors, fonts).

### Phase 2: Home + Shared Components (Est. 1–2 days)

1. Redesign Home: cream bg, grouped grid, new GameCard.
2. Extract `GameCard`; implement paper card style.
3. Redesign Coming Soon modal.
4. Update Leaderboards page.
5. Add optional `HandDrawnRule`, `PaperTexture` if time.

### Phase 3: Game Pages (Prioritized) (Est. 2–3 days)

**Priority order:** 1) Daily-log, TMR (personal tools, high use); 2) 24, Jeopardy, Chwazi (social); 3) Poker landing; 4) Pear Navigator chrome; 5) Admin.

1. Wrap each game in `PageShell` (or pass `showBack` prop).
2. Replace gradient backgrounds with cream in each component.
3. Adapt cards, buttons, inputs to design tokens.
4. Game24: redesign number cards and operators (biggest visual change).
5. Poker: landing only; lobby/table keep green.
6. Pear Navigator: back link + minimal chrome tweaks.

### Phase 4: Polish, Handwritten Accents, Testing (Est. 1 day)

1. Add 1–2 handwritten/doodle accents (e.g., divider, marginalia on one card).
2. Paper texture pass (optional, low opacity).
3. Responsive pass.
4. Accessibility: focus states, contrast check.
5. Cross-browser test.

---

## Open Questions for User

1. **Game grouping:** Confirm grouping (Personal / Play with others / Demo) or prefer flat list?
2. **Site name:** "Game Hub" vs "sfjc.dev" vs other for header/logo?
3. **Primary nav:** Dropdown for games vs simple "All Games" link?
4. **Poker/ Pear:** Keep green felt and dark tablet theme, or unify everything to Ink & Paper?
5. **Doodle intensity:** Minimal (1–2 accents total) vs moderate (per-section dividers, per-card marginalia)?
6. **Charter availability:** Charter may need fallback (Bitstream Charter, system serif). Accept or prefer different body font (e.g., Source Serif 4)?

---

## Appendix: Rollback Instructions

### Option A: Branch-based

```bash
# Before starting work
git checkout -b pre-ink-paper-overhaul
git push origin pre-ink-paper-overhaul

# To revert after overhaul
git checkout main
git reset --hard pre-ink-paper-overhaul
git push --force origin main
```

### Option B: Tag-based

```bash
# Before starting work
git tag pre-ink-paper-overhaul
git push origin pre-ink-paper-overhaul

# To revert
git checkout main
git reset --hard pre-ink-paper-overhaul
git push --force origin main
```

### Option C: New branch for overhaul

Work on `ink-paper-overhaul` branch. If satisfied, merge to main. If not, discard branch and keep main unchanged.

**Recommendation:** Use Option A or C. Tag (B) is immutable and good for long-term reference; branch allows easy diff and selective revert.
