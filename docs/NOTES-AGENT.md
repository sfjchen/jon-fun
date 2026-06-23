# Notes — AI agent reference

Dense map for agents working on **`/games/notes`**. Product philosophy: [NOTES-DESIGN.md](./NOTES-DESIGN.md). Domain packs: [NOTES-KNOWLEDGE.md](./NOTES-KNOWLEDGE.md).

## Stack (current — do not revert)

| Layer | Choice |
|-------|--------|
| Editor | **Tiptap-only** — `EditorShell` → `TiptapNoteEditor` (no CodeMirror, no `NEXT_PUBLIC_NOTES_WYSIWYG`) |
| Storage | Markdown string in `NoteSession.notes`; images as `[📷 id]` + `session.screenshots[id].base64` |
| AI | SSE `POST /api/notes/lookup`; parallel streams via `streamByLookupId` |
| Sync | localStorage + Supabase `note_sessions`; restore uses `skipPersist` + `loadActiveSession()` |

## Key paths

```
src/app/games/notes/          page + notes.css
src/components/notes/         NotesApp, EditorShell, TiptapNoteEditor, SidePanel, FollowUpComposer
src/lib/notes/                types, storage, triggerParser, streamClient, llm, attachments
src/lib/notes/tiptap/         extensions, noteAttachment, editorCoords, pasteImages
src/app/api/notes/            sessions, lookup, embed, glossary, sources
e2e/notes*.spec.ts            E2E matrix (see NOTES-DESIGN.md)
e2e/helpers/notes-mock.ts     mock API + editor helpers
```

## Trigger grammar

- `line?` — line lookup (~400ms debounce)
- `line??` — section lookup
- `> text` — todo (rollup)
- `*text*` — highlight decoration
- Paste/drop/📷 — screenshot attachment node

## localStorage keys

| Key | Purpose |
|-----|---------|
| `notes_sessions` | All `NoteSession[]` |
| `notes_active_session_id` | Active note id |
| `notes_sync_key` | Cross-device merge key |
| `notes_user_id` | Device UUID for Supabase |
| `notes_ui_prefs` | Panel width, open sections |
| `notes_glossary` / `notes_sources` | Memory bank (local) |

Legacy `uvimco_notes_*` keys migrate on load.

## Verify loop (run after Notes changes)

**Cycle A — unit (fast):**

```bash
npm run verify:notes-triggers
npm run verify:notes-attachments
npm run type-check
```

**Cycle B — local E2E (kill port 3001 first):**

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null
npm run test:e2e:notes
```

If dev server 500 / missing `routes-manifest.json`: `rm -rf .next && npm run build`, then retry.

**Cycle C — deploy (optional, needs live sfjc.dev + keys):**

```bash
npm run test:e2e:notes-deploy
npm run smoke:notes-llm
```

## Common agent mistakes

1. **Reintroducing CodeMirror** — `NoteEditor.tsx` / `cmDecorations.ts` are deleted; editor is Tiptap-only.
2. **Restore overwrite** — `SyncPanel` calls `onSynced({ skipPersist: true })`; `refreshFromServer` must use `loadActiveSession()` not in-memory id only.
3. **Screenshot paste = text only** — must insert `noteAttachment` node + `SCREENSHOT` reducer action.
4. **E2E editor selector** — `[data-testid="notes-tiptap-editor"] .ProseMirror` only (not `.uvimco-cm`).
5. **Supabase migrations** — apply via MCP `apply_migration`; project `nzviiorrlsdtwzvzodpg`.
6. **Large screenshots** — `stripScreenshotsForSync` drops base64 >200KB from cloud push (local kept).

## API routes

| Route | Role |
|-------|------|
| `GET/POST/DELETE /api/notes/sessions` | Sync sessions by `userId` |
| `POST /api/notes/lookup` | SSE AI lookup/follow-up/decode |
| `POST /api/notes/embed` | RAG re-rank (Gemini embeddings) |
| `GET/POST /api/notes/glossary` | Glossary sync |
| `GET/POST /api/notes/sources` | Sources memory bank |

## Changelog

- **2026-06-23**: Agent doc; Tiptap-only; attachments; parallel AI; 3-cycle verify loop.
