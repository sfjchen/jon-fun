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

Other shorthand: suffix `>` / `<` todo (or legacy prefix `>`), `*highlight*` spans. No `~` approx marker.

## AI response contract

- **Core meaning** — plain English + domain context (UVIMCO endowment when that domain is active); intuitive, direct; no "Intent" or separate "angle" block
- **Typical ranges** — only for metrics/ratios/variables: common magnitudes and what they signal (omit for non-numeric terms)
- Panel renders full **conversation thread** (user follow-ups + assistant replies stack downward; streaming appends at bottom)
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
- Optional **sync password** links devices (shared string)
- **Restore** after cache clear: enter sync password or device ID → pull from server
- **Bidirectional merge** on pull: per-session winner = newest `updatedAt`; then push merged set
- **Pull triggers:** page load (always); tab visible again (if ≥30s since last pull *or* tab hidden ≥30s); periodic (5m visible / 1h hidden); explicit save (Ctrl+S, tab hide, Save & Sync); debounced typing save pulls at most every 30s (otherwise push-only)
- **Cross-device:** device B picks up device A saves via the above polling — no Supabase Realtime yet (`note_sessions` has RLS but no anon read policy / publication entry; API-only sync keeps sync-password model simple)

Data lives on Supabase under `note_sessions` (+ `notes_sources`, `notes_glossary`).

## UI principles

- **Editor-first** — full-width Tiptap WYSIWYG; panel for AI + vault utilities
- **Panel order (top→bottom):** Notes vault (folders + Inbox) → Todos → AI lookup → Glossary → Sources → History → Sync & backup (collapsed)
- **Parallel AI** — multiple `?`/`??` triggers run concurrently; status bar shows active count; history shows streaming dots
- **Sync rare** — collapsed under “Sync & backup”; expand only when setting key or restore
- Notion-like light theme, Lato; Ctrl `\` panel, `Shift+F` search, `K` summarize, **Export menu** (Markdown / PDF), `Shift+N` new note, **Ctrl+S** save+sync, **Ctrl+E** quick MD export
- **Top bar:** sfjc.dev · Notes · title · tags · created date
- **Bottom bar:** stats · action buttons + hotkey badges · Hints toggle · paste screenshot hint
- **Panel lookup:** text field at top of AI section — ask without typing `?` in the note (optional trailing `?` / `??`)
- **Editor:** Tiptap + `@tiptap/markdown` ([`EditorShell`](../../src/components/notes/EditorShell.tsx) → [`TiptapNoteEditor`](../../src/components/notes/TiptapNoteEditor.tsx)); markdown stored in `NoteSession.notes`
- **Screenshots:** paste/drop/📷 Attach → inline image node; stored as `[📷 id]` in markdown + base64 in `session.screenshots`; follow-up composer shows thumbnails and sends images to lookup API
- **Models (Jun 2026):** lookup `google/gemini-2.5-flash-lite`; decode/follow-up/images `gemini-2.5-flash`; embed `gemini-embedding-001`

## Device tiers (Jun 2026)

Breakpoint **`768px`** (`md`) — helpers in [`device.ts`](../../src/lib/notes/device.ts), hook [`useNotesDevice`](../../src/lib/notes/useNotesDevice.ts).

| Tier | Detect | Panel | Shortcuts | Chrome |
|------|--------|-------|-----------|--------|
| **Phone** | ≤767px / touch viewport | Overlay + backdrop dismiss; no panel header or ×; closed by default | Status bar buttons only (no kbd badges); **no** Ctrl/Cmd panel/search/summarize handlers except **save** in fields | Safe-area insets; 44px tap targets; horizontal toolbar scroll; summarize runs AI without opening panel |
| **Laptop / desktop** | ≥768px pointer | Side-by-side; resizable handle; **open by default** (persisted in `notes_ui_prefs`) | Full keyboard map — **Cmd** labels on Mac, **Ctrl** on Windows/Linux; metaKey + ctrlKey both accepted | Hints row in status bar; summarize opens panel |
| **Mac-specific** | `navigator.platform` / `userAgentData` | Same as desktop | UI badges use **Cmd+…**; handlers accept ⌘ | — |

Shared: `?` / `??` triggers always open panel (phone included); Escape closes search or clears lookup focus — **does not** close the side panel.

## E2E test matrix

| Spec | Mode | What it covers |
|------|------|----------------|
| `e2e/notes.spec.ts` | Local (mock API) | Editor, triggers `?`/`??`, follow-up, search, sync password, tags, history, Ctrl+S, suffix todos, highlights, legacy URL + localStorage migration, builtin packs |
| `e2e/notes-search.spec.ts` | Local | Ctrl+Shift+F search hits |
| `e2e/notes-restore.spec.ts` | Local mock | Restore by sync password |
| `e2e/notes-attachments.spec.ts` | Local (mock API) | Image attach in editor, marker restore, follow-up screenshot → lookup API |
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
| **3** | Tiptap WYSIWYG (default editor) | Bold/lists; triggers; markdown round-trip; attachments; E2E green |

## Changelog

- **2026-06-22**: Initial doc; Phase 1 implementation — `?`/`??` triggers, global search, sync restore, metadata/tags, structured AI panel, autoglossary, rollup, resizable panel.
- **2026-06-22**: Phase 2 — sources/glossary tables, context assembler, Sources UI.
- **2026-06-22**: Knowledge layer — domain packs, auto-sectioning, generalizable prompts ([NOTES-KNOWLEDGE.md](./NOTES-KNOWLEDGE.md)).
- **2026-06-22**: AI response format — Core meaning + Typical ranges (removed Intent/angle/follow-up split).
- **2026-06-23**: Parallel AI lookups; panel UX reorder; sync/glossary/sources collapsed; restore no longer overwritten by stale in-memory session; SSE `[DONE]` completes streams in mock E2E.
- **2026-06-23**: Unified top/bottom bars; tags replace kind/domain; auto domain; note history; todo suffix + `*highlight*`; Ctrl+S save/sync; hints in bottom bar.
- **2026-06-23**: Phase 3 complete — Tiptap-only; `noteAttachment` screenshots; FollowUpComposer previews; agent doc [`NOTES-AGENT.md`](./NOTES-AGENT.md).
- **2026-06-22**: Notes vault — folders + Inbox tree as top panel section; `metadata.folderId`; folder sync via vault session row.
- **2026-06-22**: Export menu — Markdown (.md) + formatted PDF; metadata/tags, full lookup threads, action items; Ctrl+E → MD.
- **2026-06-24**: Device tiers — phone overlay panel, desktop default-open + resize, Mac Cmd labels, mobile-safe shortcuts.
- **2026-06-24**: UX polish — status bar Saved/Synced distinction, sync panel hint, vault empty inbox, AI empty hint, note drag grips, mobile Notes panel button.
