# UI Overhaul Plan: Ink & Paper Theme

## Executive Summary

**Goals:** Rebrand sfjc.dev from purple-gradient, glassmorphism to Ink & Paper—cream, ink typography, editorial clarity. Concise, simple, direct, minimal. No clutter.

**Constraints:** Preserve all functionality; game-specific UIs (Poker green felt, Pear Navigator dark) retain thematic divergence; avoid Inter, Roboto, purple gradients; minimal doodle intensity; fewer pages/redirects.

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

Import Lora (400, 600) and Charter (400) from Google Fonts. Fallback: `Charter, 'Bitstream Charter', Georgia, serif`. Revisit body font later—Source Serif 4 or similar if Charter feels off.

### Spacing Scale

- Base: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96.
- Content max-width: ~65ch (≈42rem) for prose; game grids may extend to 72rem.

### Component Tokens

- **Card:** `bg-[var(--ink-paper)]`, `border border-[var(--ink-border)]`, `rounded-lg` (8px), subtle shadow `0 1px 3px rgba(0,0,0,0.06)`.
- **Button primary:** `bg-[var(--ink-accent)]`, `text-white`, hover darken 5%.
- **Button secondary:** `border border-[var(--ink-border)]`, `text-[var(--ink-text)]`, hover `bg-[var(--ink-paper)]`.
- **Link:** `text-[var(--ink-accent)]` with `underline` or `underline-offset-2`; hover slight darken.

### Handwritten / Doodle Accents

**Minimal intensity for now.** Defer most accents. If added later: one subtle divider or 1 marginalia max. No wobbly underlines, no paper texture initially. Keep poker-table.svg; emoji for other games is fine.

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

### Primary Nav

- **Site name:** sfjc.dev (header/logo).
- **No dropdown, no "All Games" link.** Home shows flat game grid—all games equally. Minimal nav: logo left, optional "Leaderboards" link; back link (← Home) on subpages only.

### Secondary Nav

- None. Games are the home content. No extra pages or redirects.

### Home Structure (Minimal)

1. **Header:** "sfjc.dev" only. No tagline unless one short line.
2. **Game grid:** Flat list—all games shown equally, no grouping. Same card treatment for each.
3. **Coming Soon:** Card opens modal (retain; restyle for Ink & Paper).
4. **Max-width** ~72rem for grid; concise, no clutter.

---

## Page-by-Page Plan

### Home

- **Layout:** Centered column, max-width 72rem. Cream background. Minimal.
- **Content hierarchy:** "sfjc.dev" header → flat game grid (all equal, no grouping).
- **Key elements:** GameCard (paper card, ink text); Coming Soon modal (paper-style).
- **Layout notes:** 2–3 columns desktop; 1 col mobile. Concise, no clutter.

### Game Pages (Shared Shell)

- **Layout:** Shared `PageShell` with: back link (← Home), optional game title. Minimal.
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
| `page.tsx` (Home) | Full redesign: Ink & Paper, flat game grid, new modal |
| `GameCard` (inline) | Extract to `components/GameCard.tsx`; paper card, ink typography |
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
| `PageShell` | Shared layout: sfjc.dev logo, back link on subpages. Minimal. |
| `GameCard` | Extracted, reusable paper card |
| Design tokens | Tailwind + CSS vars; no InkButton/InkCard components unless needed |

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

1. Redesign Home: cream bg, flat game grid, new GameCard.
2. Extract `GameCard`; implement paper card style.
3. Redesign Coming Soon modal.
4. Update Leaderboards page.

### Phase 3: Game Pages (Prioritized) (Est. 2–3 days)

**Priority order:** 1) Daily-log, TMR (personal tools, high use); 2) 24, Jeopardy, Chwazi (social); 3) Poker landing; 4) Pear Navigator chrome; 5) Admin.

1. Wrap each game in `PageShell` (or pass `showBack` prop).
2. Replace gradient backgrounds with cream in each component.
3. Adapt cards, buttons, inputs to design tokens.
4. Game24: redesign number cards and operators (biggest visual change).
5. Poker: landing only; lobby/table keep green.
6. Pear Navigator: back link + minimal chrome tweaks.

### Phase 4: Polish, Testing (Est. 1 day)

1. Minimal doodle (defer unless one accent adds value).
2. Responsive pass.
3. Accessibility: focus states, contrast check.
4. Cross-browser test.

---

## Resolved Decisions

- **Game grouping:** Flat list—all games equal.
- **Site name:** sfjc.dev.
- **Nav:** No dropdown, no "All Games" link. Flat game grid on home.
- **Poker/Pear:** Keep game-specific themes (green felt, dark tablet).
- **Doodle intensity:** Minimal for now.
- **Body font:** Charter with fallback; revisit Source Serif 4 if needed.

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
