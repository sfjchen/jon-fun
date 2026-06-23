# Notes knowledge architecture

How **Notes** stays **general** (5–10 year vault) while tuning AI for **current focus domains** (UVIMCO internship, portfolio quant, CFA L1).

## Principles

| Principle | Implementation |
|-----------|----------------|
| **General product, specific packs** | UI = "Notes"; code under `src/lib/notes` |
| **Domain packs, not hardcoded prompts** | `src/lib/notes/knowledge/registry.ts` |
| **Auto domain inference** | Tags + kind + body keywords → primary domain; override via metadata.domain |
| **Auto sectioning** | Blank-line blocks → outline in every AI call (`sectioning.ts`) |
| **Layered context** | Built-in packs → user Sources → glossary → related notes |
| **Dense, AI-first** | Bullet core context; no prose essays in packs |

## Folder map

```
src/lib/notes/knowledge/
  registry.ts       # Domain definitions + resolveDomainsForNote()
  sectioning.ts     # parseNoteSections(), formatSectionsOutline()
  builtinSources.ts # Seed [Pack] sources into Sources panel
  prompts.ts        # Dynamic system prompts (replaces static UVIMCO-only text)

docs/
  NOTES-DESIGN.md   # Product UX
  NOTES-KNOWLEDGE.md # This file
```

## Active domains (2026)

| ID | Label | When used |
|----|-------|-----------|
| `uvimco-endowment` | UVIMCO endowment | **Default** ~10 weeks; tags IC/GP/endowment |
| `portfolio-quant` | Grinold & Kahn / pioneering PM | IR, active share, alpha, APM tag |
| `cfa-l1` | CFA Level I | Ethics, FRA, quant, FI tags |
| `general` | Fallback | Non-finance or unmatched |

Change default without code: `NOTES_ACTIVE_DOMAIN=portfolio-quant` (server env).

Per-note override: **Domain (auto)** dropdown under title.

## Built-in reference packs

On first load, three packs seed into **Sources** (toggle ●/○ for AI context):

1. **[Pack] UVIMCO endowment** — on by default  
2. **[Pack] Portfolio management (quant)** — on by default  
3. **[Pack] CFA Level I** — off by default (enable when studying)

Add your own via **+ Paste doc** (IPS, memos, book notes). Prefer short, structured paste — AI uses first ~1500 chars per source in context.

## Context assembly order (lookup / summarize)

1. Resolve **primary domain** (explicit → tags/keywords → default)  
2. **Section outline** of full note  
3. **Sources** ranked by query + domain tag overlap  
4. **Glossary** (recent terms)  
5. **Related notes** (recency + tag overlap + section preview)

## Adding a new domain later

1. Add entry to `KNOWLEDGE_DOMAINS` in `registry.ts`  
2. Optional: add to `buildBuiltinSources()` in `builtinSources.ts`  
3. Add tag hints users can apply to notes  
4. No route renames required

## Changelog

- **2026-06-23**: Paths renamed to `notes/*`; enriched pack content; all packs on by default; RAG via `/api/notes/embed`.
