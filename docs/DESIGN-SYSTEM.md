# sfjc.dev Design System

**For AI agents:** Product/UX principles → README **[Core design principles](../README.md#core-design-principles)**. **This file** = tokens, typography, layout. **`docs/ARCHITECTURE-MAP.md`** = routes and stack boundaries.

---

## Single public theme: Notebook

**Deployed at `/` and all `/games/*` routes.** Applied via `data-theme="notebook"` on the shell (Patrick Hand, cream line paper, Stanford-adjacent red accent).

### Color palette (notebook)

| Token | Hex | Usage |
|-------|-----|-------|
| `--nb-bg` | `#fcf9f4` | Page background |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-muted` | `#6b6359` | Secondary |
| `--nb-accent` | `#8c3838` | Links, CTAs |
| `--nb-border` | `#eee9e2` | Dividers |
| `--nb-paper` | `#faf6f0` | Cards |

Notebook maps from shared `--ink-*` tokens in `globals.css` via `data-theme="notebook"`.

### Typography

- **All text:** Patrick Hand (handwritten). Sizes in `globals.css`.
- **Notes app:** Lato — exception at `/games/notes`.

### Line paper

- `.notebook-line-paper` on outer shell only; `background-attachment: fixed`.
- Inner cards: transparent so lines show through.
- Home grid: `gap-y-[30px]` + `pt-[30px]` for line alignment.

### Navigation

- Masthead **sfjc.dev** → `/`; subpages **← Home**.
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
- [`docs/Website-Themes-Reference.md`](Website-Themes-Reference.md) — **inspiration only** (not deployed)
- [`docs/UI-Overhaul-Plan-Ink-And-Paper.md`](UI-Overhaul-Plan-Ink-And-Paper.md) — historical plan
