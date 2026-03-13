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
| `--nb-bg` | `#faf7f1` | Page background (lighter cream) |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-muted` | `#6b6359` | Secondary |
| `--nb-accent` | `#8c3838` | Links, CTAs (Stanford-ish red) |
| `--nb-border` | `#ebe6dd` | Dividers |
| `--nb-paper` | `#f7f3ea` | Cards |

### Typography

- **All text:** Patrick Hand (readable handwritten). Applied via `[data-theme="notebook"]` with `font-size: 1.2rem`.
- **Inputs, textarea, button:** Inherit Patrick Hand.

### Doodles

- `public/doodles/notebook/` — Doodly, handwritten-style variants (tmr, daily, pear, game24, jeopardy, chwazi, leaderboards, coming-soon, poker).
- Notebook pages use these; main pages use `public/doodles/`.

### Line Paper

- **Single source:** `.notebook-line-paper` on outer shell only; `background-attachment: fixed` so lines align everywhere.
- **Inner boxes** (GameCards, modals, cards): `bg-transparent` so fixed lines show through.
- **1 Sentence Everyday** (main): inner uses `.notebook-line-paper`; (notebook): inner uses `bg-transparent`.

### Navigation

- Main site: "Notebook" link → `/notebook`.
- Notebook site: "Main" link → `/`, "← Home" → `/notebook`.

---

## Related Docs

- `docs/Website-Themes-Reference.md` — Alternative themes (Monolith, Charcoal, etc.)
- `docs/UI-Overhaul-Plan-Ink-And-Paper.md` — Original overhaul plan
