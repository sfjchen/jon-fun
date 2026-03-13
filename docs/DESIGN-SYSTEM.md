# sfjc.dev Design System

**For AI agents:** Use this doc when making UI/theme changes. Keep it in sync with `src/app/globals.css`.

---

## Active Theme: Ink & Paper (Cream + Burgundy)

### Color Palette (CSS variables in `globals.css`)

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink-bg` | `#faf6f0` | Page background (warm cream) |
| `--ink-text` | `#1a1a1a` | Primary text (black) |
| `--ink-muted` | `#6b6359` | Secondary text, captions (taupe) |
| `--ink-accent` | `#800020` | Links, CTAs, highlights (burgundy) |
| `--ink-border` | `#e8e2da` | Dividers, card borders |
| `--ink-paper` | `#f5f1eb` | Cards, sections (slightly darker cream) |

### Typography

- **Headings:** Lora (400, 600)
- **Body:** Charter, 'Bitstream Charter', Georgia, serif
- **Avoid:** Inter, Roboto, Space Grotesk

### Guidelines

- **Concise, simple, direct, minimal.** No clutter.
- **Black text** for most content. Muted for secondary.
- **Burgundy accent** for links, CTAs, small highlights—not large blocks.
- **No purple gradients.** No glassmorphism on main pages.
- **Game-specific themes:** Poker lobby/table = green felt. Pear Navigator inner = dark. All else uses Ink & Paper.

### Component Tokens

- **Card:** `bg-[var(--ink-paper)]`, `border-[var(--ink-border)]`, `rounded-lg`
- **Button primary:** `bg-[var(--ink-accent)]`, `text-white`
- **Link:** `color: var(--ink-accent)` with hover darken

### Layout

- **PageShell:** sfjc.dev header, ← Home on subpages. No header border on home.
- **Content:** `max-w-6xl mx-auto px-4`. Full-bleed for Pear Navigator, Poker lobby/table.

---

## Alternate Theme: Notebook (at `/notebook`)

Same functionality as main site, different aesthetic. Applied when pathname starts with `/notebook` via `data-theme="notebook"`.

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--nb-bg` | `#f9f5ed` | Page background (creamier) |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-muted` | `#6b6359` | Secondary |
| `--nb-accent` | `#5c4a3d` | Links, CTAs (graphite/sepia) |
| `--nb-border` | `#e8e2d8` | Dividers |
| `--nb-paper` | `#f5f0e6` | Cards |

### Typography

- **All text:** Patrick Hand (readable handwritten). Applied via `[data-theme="notebook"]` with `font-size: 1.2rem`.
- **Inputs, textarea, button:** Inherit Patrick Hand.

### Doodles

- `public/doodles/notebook/` — Doodly, handwritten-style variants (tmr, daily, pear, game24, jeopardy, chwazi, leaderboards, coming-soon, poker).
- Notebook pages use these; main pages use `public/doodles/`.

### Line Paper

- **All notebook pages** (except Pear Navigator, Poker lobby/table): main content area uses `.notebook-line-paper`.
- **1 Sentence Everyday** (main and notebook): full page uses line paper.
- **GameCards, modals, cards, tabs**: line paper when in notebook.

### Navigation

- Main site: "Notebook" link → `/notebook`.
- Notebook site: "Main" link → `/`, "← Home" → `/notebook`.

---

## Related Docs

- `docs/Website-Themes-Reference.md` — Alternative themes (Monolith, Charcoal, etc.)
- `docs/UI-Overhaul-Plan-Ink-And-Paper.md` — Original overhaul plan
