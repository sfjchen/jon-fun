# sfjc.dev Design System

Tokens, typography and layout. Routes and stack boundaries are in [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md).

---

## Default theme: Notebook

`PageShell` sets `data-theme="notebook"` (Patrick Hand, cream line paper, Stanford-adjacent red accent) on the home page and every route without its own theme. Game-themed routes, Notes and Chwazi on phones do not get it.

### Color palette (notebook)

| Token | Hex | Usage |
|-------|-----|-------|
| `--nb-bg` | `#fcf9f4` | Page background |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-muted` | `#6b6359` | Secondary |
| `--nb-accent` | `#8c3838` | Links, CTAs |
| `--nb-border` | `#eee9e2` | Dividers |
| `--nb-paper` | `#faf6f0` | Cards |

Under `data-theme="notebook"` the shared `--ink-*` tokens resolve to these `--nb-*` values (`globals.css`), so components only use `--ink-*`.

### Typography

- **Notebook pages:** Patrick Hand (handwritten). Sizes in `globals.css`.
- **Game-themed pages:** system sans, VT323 for Krillion, EB Garamond and Playfair Display for Anthropeum (`game-themes.css`).
- **Notes app:** Lato, loaded with `next/font` in its layout.
- Web fonts load from 1 Google Fonts request at the top of `globals.css`. Add a family there, not in a new `@import`.

### Line paper

- `.notebook-line-paper` on outer shell only; `background-attachment: fixed`.
- Inner cards: transparent so lines show through.
- Home grid: 2 columns at every width, `gap-3` on phones.

### Navigation

- Only the home page shows the **sfjc.dev** masthead. Every other page gets the full screen and a small home icon (floating on full-bleed pages).
- Redirects: `/notebook/*` → `/*`; legacy `/theme2/*` → canonical routes (see `next.config.mjs`).

---

## Shared tokens (`--ink-*`)

Used by party games, Connections, and components that predate notebook mapping:

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink-bg` | `#faf6f0` | Warm cream |
| `--ink-text` | `#1a1a1a` | Body |
| `--ink-muted` | `#6b6359` | Captions |
| `--ink-accent` | `#800020` | Burgundy CTA (party games) |
| `--ink-border` | `#e8e2da` | Borders |
| `--ink-paper` | `#f5f1eb` | Cards |

On notebook pages these resolve through `--nb-*` where mapped.

---

## Game themes

Daily games, SET, Connections and the leaderboard set `data-game-theme` (`PageShell`, styles in `game-themes.css`): white surfaces, sans-serif controls, and 1 accent per game in `--game-color` (from `--g-set`, `--g-bee`, `--g-connections`, `--g-mini`, `--g-fivefold`, `--g-krillion`). Shared pieces are `.daily-heading` (header with the accent rule) and the per-game button classes (`.set-primary`, `.krillion-action`, `.anthro-button`). Krillion keeps its pixel ocean look and Anthropeum its parchment and burgundy.

---

## Shell exceptions

| Surface | Chrome |
|---------|--------|
| **Notes** | Minimal back link; Lato workspace |
| **Poker lobby/table** | Full-bleed green felt |
| **Pear Navigator** | Dark inner UI |
| **Chwazi mobile** | Touch-first; compact header |

---

## Contrast rule (WCAG AA)

On cream `--ink-paper` / `--nb-paper`: use `var(--ink-text)` / `var(--nb-text)`, not `text-white`. White text only on dark/accent backgrounds.

---

## Related docs

- [`docs/ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md) — routes, backends
