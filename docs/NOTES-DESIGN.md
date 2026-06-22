# Notes design philosophy (2026)

Living design doc for **Notes** at `/games/notes`. Modeled after [READER-BENCHMARK.md](./READER-BENCHMARK.md). Update the changelog at the bottom each iteration.

## Positioning

| | Notes | Notion | Obsidian |
|---|-------|--------|----------|
| **Primary job** | Live meeting capture + domain AI | Team wiki + databases | Personal linked vault |
| **AI** | Trigger-native (`?` / `??`), domain packs (UVIMCO, APM, CFA L1) | Slash commands, page AI | Plugins / Copilot |
| **Structure** | Unified vault: notes → lookups → glossary → sources | Pages + DBs | Files + graph |

Notes is **not** a Notion database clone or Obsidian plugin host. It is a **long-term personal knowledge vault** (finance, learning, meetings) — currently tuned for internship/endowment work via **domain packs** ([NOTES-KNOWLEDGE.md](./NOTES-KNOWLEDGE.md)).

## Unified vault

One structure, built incrementally:

```
NoteSession (title, tags, body, metadata)
  → Lookups (AI Q&A per trigger)
  → Glossary (auto-extracted terms)
  → Sources (reference docs for AI — Phase 2)
  → Rollups (cross-session todos)
```

Cross-note discovery: **global search**, glossary, related tags, context assembler (Phase 2).

## Trigger grammar

| Syntax | Fires | AI mode | Context |
|--------|-------|---------|---------|
| Line ending with `?` | Immediately on typing `?` (~400ms debounce) | `line` | Current line + ~15 lines before |
| Line ending with `??` | On second `?` | `section` | Paragraph block / section until blank line |

**Removed:** inline `?term` — use **global search → Terms** or autoglossary.

Other shorthand unchanged: `>` todo, `*` highlight, `~` approx, screenshot paste.

## AI response contract

- **Core meaning** — plain English + domain context (UVIMCO endowment when that domain is active); intuitive, direct; no "Intent" or separate "angle" block
- **Typical ranges** — only for metrics/ratios/variables: common magnitudes and what they signal (omit for non-numeric terms)
- Panel renders via markdown component (styled labels; no raw `#`/`*` from model)
- **Sources** and **glossary** injection in prompt

## Context assembly (Phase 2)

Human-like prioritization when building LLM context:

1. Recency (notes from last 7 days weighted higher)
2. Tag overlap with active note
3. Glossary term matches in query/body
4. Source docs tagged or keyword-matched
5. Prior lookups on same topic

Token budget ~8k; overflow summarized with flash-lite.

## Sync identity

Same model as **One Sentence Everyday** / daily-learn:

- Device UUID in `localStorage` → `user_id` on Supabase
- Optional **sync key** links devices (shared string)
- **Restore** after cache clear: enter sync key or device ID → pull from server
- Push on load, debounced save, periodic sync (5m / 1h), visibility sync

Data lives on Supabase under `uvimco_note_sessions` (+ `notes_sources`, `notes_glossary` in Phase 2).

## UI principles

- Notion-like light theme, Lato, high contrast body text
- Full-width editor default; **resizable** right panel
- Ctrl shortcuts (Windows): `\` panel, `Shift+F` search, `K` summarize, `S` export, `Shift+N` new note
- Mobile: panel overlays; editor stays primary

## Phased roadmap rubric

| Phase | Scope | Pass when |
|-------|-------|-----------|
| **1** | Triggers, search, sync UI, metadata, render, glossary, rollup, panel resize | E2E + deploy lookup/sync pass |
| **2** | Sources memory bank, context assembler, RAG, Supabase glossary/sources | Sources in AI context; search finds chats |
| **3** | Tiptap WYSIWYG (feature flag) | Bold without `****`; triggers work in rich text |

## Changelog

- **2026-06-22**: Initial doc; Phase 1 implementation — `?`/`??` triggers, global search, sync restore, metadata/tags, structured AI panel, autoglossary, rollup, resizable panel.
- **2026-06-22**: Phase 2 — sources/glossary tables, context assembler, Sources UI.
- **2026-06-22**: Knowledge layer — domain packs, auto-sectioning, generalizable prompts ([NOTES-KNOWLEDGE.md](./NOTES-KNOWLEDGE.md)).
- **2026-06-22**: AI response format — Core meaning + Typical ranges (removed Intent/angle/follow-up split).
