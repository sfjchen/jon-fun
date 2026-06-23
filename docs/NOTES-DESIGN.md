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

Data lives on Supabase under `note_sessions` (+ `notes_sources`, `notes_glossary`).

## UI principles

- **Editor-first** — full-width CodeMirror default; panel for AI + vault utilities
- **Panel order (top→bottom):** AI lookup → Notes list → Glossary → Sources → Rollup → Sync & backup (collapsed)
- **Parallel AI** — multiple `?`/`??` triggers run concurrently; status bar shows active count; history shows streaming dots
- **Sync rare** — collapsed under “Sync & backup”; expand only when setting key or restore
- Notion-like light theme, Lato; Ctrl `\` panel, `Shift+F` search, `K` summarize, `S` export, `Shift+N` new note
- **Editor:** CodeMirror default ([`EditorShell`](../../src/components/notes/EditorShell.tsx)); Tiptap WYSIWYG (What You See Is What You Get) opt-in via `NEXT_PUBLIC_NOTES_WYSIWYG=1` — faster plain-text capture vs rich formatting when needed
- **Models (Jun 2026):** lookup `google/gemini-2.5-flash-lite`; decode/follow-up/images `gemini-2.5-flash`; embed `gemini-embedding-001`

## E2E test matrix

| Spec | Mode | What it covers |
|------|------|----------------|
| `e2e/notes.spec.ts` | Local (mock API) | Editor, triggers `?`/`??`, follow-up, search, sync key, legacy URL + localStorage migration, builtin packs |
| `e2e/notes-search.spec.ts` | Local | Ctrl+Shift+F search hits |
| `e2e/notes-restore.spec.ts` | Local mock | Restore by sync key |
| `e2e/notes-lookup.spec.ts` | **Deploy** (`PLAYWRIGHT_SKIP_WEBSERVER=1`) | Real Gemini lookup + Core meaning format |
| `e2e/notes-sync.spec.ts` | **Deploy** | Supabase session push + title migration |
| `e2e/notes-visual.spec.ts` | Local layout + deploy snapshots | Editor height, panel layout |

**Commands:** `npm run test:e2e:notes` (local CI) · `npm run test:e2e:notes-deploy` (sfjc.dev) · `npm run smoke:notes-llm`

Mock helper: `e2e/helpers/notes-mock.ts` — stubs `/api/notes/*` including embed RAG.

## Phased roadmap rubric

| Phase | Scope | Pass when |
|-------|-------|-----------|
| **1** | Triggers, search, sync UI, metadata, render, glossary, rollup, panel resize | E2E + deploy lookup/sync pass |
| **2** | Sources memory bank, context assembler, RAG, Supabase glossary/sources | Sources in AI context; search finds chats |
| **3** | Tiptap WYSIWYG (feature flag) | Bold without `****`; triggers work; markdown round-trip; E2E green |

## Changelog

- **2026-06-22**: Initial doc; Phase 1 implementation — `?`/`??` triggers, global search, sync restore, metadata/tags, structured AI panel, autoglossary, rollup, resizable panel.
- **2026-06-22**: Phase 2 — sources/glossary tables, context assembler, Sources UI.
- **2026-06-22**: Knowledge layer — domain packs, auto-sectioning, generalizable prompts ([NOTES-KNOWLEDGE.md](./NOTES-KNOWLEDGE.md)).
- **2026-06-22**: AI response format — Core meaning + Typical ranges (removed Intent/angle/follow-up split).
- **2026-06-23**: Parallel AI lookups; panel UX reorder; sync/glossary/sources collapsed; restore no longer overwritten by stale in-memory session; SSE `[DONE]` completes streams in mock E2E.
- **2026-06-23**: Editor — CodeMirror default; Tiptap opt-in (`NEXT_PUBLIC_NOTES_WYSIWYG=1`); dual-path E2E helpers.
