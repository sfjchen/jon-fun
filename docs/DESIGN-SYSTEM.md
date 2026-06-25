# sfjc.dev Design System

**For AI agents:** **Product, UX, and data-model principles** (audience, navigation, minimal UI, sync philosophy) live in the README **[Core design principles](../README.md#core-design-principles)** section. **This file** is the reference for **color tokens, typography stacks, layout notes, and theme mechanics**—keep it aligned with `src/app/globals.css`.

---

## Active themes (deployed)

| Theme | Route | Role |
|-------|-------|------|
| **Notebook** | `/`, `/games/*` | Primary public theme (`data-theme="notebook"`, Patrick Hand, line paper) |
| **Ink & Paper mirror** | `/theme2`, `/theme2/games/*` | Legacy burgundy palette entry points; Connections uses `basePath="/theme2/games/connections"`. Most game pages re-export `/games/*` routes. |
| **Archive (not routed)** | `src/app/_archive/theme2` | Next.js private folder — source reference only |

Token details below still describe **Ink & Paper** (`--ink-*`) used by party games, Connections mirror, and Notes-adjacent surfaces. Notebook maps `--nb-*` in `globals.css`.

---

## Ink & Paper tokens (cream + burgundy)

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
- **Header exceptions (own-theme pages):** Pear Navigator and Chwazi mobile use compact header (px-3 py-2, smaller logo); notebook subpages otherwise use the standard header (px-4 py-3 md:py-4, text-3xl md:text-4xl).

---

## Default Theme: Notebook (at `/`)

Main site aesthetic (the only **public** theme). Applied when the shell is in notebook mode via `data-theme="notebook"` (Chwazi mobile is an exception and uses the root Ink & Paper look without the notebook line paper).

### Color Palette (notebook)

| Token | Hex | Usage |
|-------|-----|-------|
| `--nb-bg` | `#fcf9f4` | Page background (brighter cream) |
| `--nb-text` | `#1a1a1a` | Primary text |
| `--nb-muted` | `#6b6359` | Secondary |
| `--nb-accent` | `#8c3838` | Links, CTAs (Stanford-ish red) |
| `--nb-border` | `#eee9e2` | Dividers |
| `--nb-paper` | `#faf6f0` | Cards |

### Typography

- **All text:** Patrick Hand (readable handwritten). Applied via `[data-theme="notebook"]` plus optional `html.notebook-theme-root` scale—**exact sizes:** see `globals.css` (values evolve; README principles stay stable).
- **Inputs, textarea, button:** Inherit Patrick Hand.

### Doodles

- `public/doodles/notebook/` — Doodly, handwritten-style variants. Default theme uses these; non-notebook surfaces (e.g. archived Ink & Paper pages in source) may use `public/doodles/`.

### Line Paper

- **Single source:** `.notebook-line-paper` on outer shell only; `background-attachment: fixed` so lines align everywhere.
- **Inner boxes** (GameCards, modals, cards): `bg-transparent` so fixed lines show through.
- **Home grid:** `gap-y-[30px]` and `pt-[30px]` on main for line alignment with card edges.

### Navigation

- Masthead **sfjc.dev** links to `/`; subpages use **← Home** to `/`.
- Redirect: `/notebook` and `/notebook/*` → `/` and `/*` (permanent).

---

## Alternate Theme: Ink & Paper mirror (`/theme2`)

Live at **`/theme2`** for visual-regression E2E and Connections `basePath`. Game routes re-export canonical `/games/*` pages where possible; Connections keeps theme-specific paths. Archived duplicate sources: `src/app/_archive/theme2` (not routed).

---

## Related Docs

- `docs/Website-Themes-Reference.md` — **Inspiration only** (Monolith, Slate, etc. — not deployed routes)
- `docs/ARCHITECTURE-MAP.md` — Route inventory, shared libs, perf levers
- `docs/UI-Overhaul-Plan-Ink-And-Paper.md` — Original overhaul plan
