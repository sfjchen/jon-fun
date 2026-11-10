# Notes (`/games/notes`) developer notes

Tiptap notes vault with inline AI lookups. Sync and owner access: `docs/SYNC.md`.

## Stack
- Editor: Tiptap only (`EditorShell` -> `TiptapNoteEditor`). No CodeMirror.
- Storage: markdown string in `NoteSession.notes`. Images are `[📷 id]` plus `session.screenshots[id].base64`.
- AI: SSE `POST /api/notes/lookup`, parallel streams via `streamByLookupId`. `POST /api/notes/embed` re-ranks context with Gemini embeddings.
- Sync: localStorage plus Supabase `note_sessions` (also `notes_sources`, `notes_glossary`). API-only, no Realtime.
- Models: lookup `gemini-2.5-flash-lite`, follow-up/images `gemini-2.5-flash`, embed `gemini-embedding-001`.

## Paths
```
src/app/games/notes/        page + notes.css
src/components/notes/       NotesApp, EditorShell, TiptapNoteEditor, SidePanel, FollowUpComposer, NotesActionUi
src/lib/notes/              types, storage, triggerParser, streamClient, llm, attachments, device
src/lib/notes/tiptap/       extensions, noteAttachment, editorCoords, pasteImages
src/lib/notes/knowledge/    registry, sectioning, builtinSources, prompts
src/app/api/notes/          sessions, lookup, embed, glossary, sources
e2e/notes*.spec.ts          E2E, mocks in e2e/helpers/notes-mock.ts
```

## Triggers
- `line?` fires a line lookup (~400ms debounce), context is the line plus ~15 lines before.
- `line??` fires a section lookup (paragraph block).
- Suffix `>` / `<` makes a todo, `*text*` highlights.
- Paste, drop or Attach inserts a `noteAttachment` node.
- Tables: Tiptap TableKit, toolbar button or `Ctrl+Alt+T`, pastes TSV/CSV as a table.

## Sync model
- Device UUID in localStorage becomes `user_id` on Supabase. An optional shared string links devices.
- Pull merges per session, newest `updatedAt` wins, then pushes the merged set.
- Pull on page load, tab visible (>=30s since last pull), every 5m visible / 1h hidden, and explicit save.
- Cloud push drops screenshots over 200KB (`stripScreenshotsForSync`). Local copy is kept.
- AI routes require the owner secret when `SFJC_SYNC_PASSWORD` is set.

## localStorage keys
`notes_sessions`, `notes_active_session_id`, `notes_sync_key`, `notes_user_id`, `notes_ui_prefs`, `notes_glossary`, `notes_sources`.

## UI rules
- Panel order: vault, todos, AI lookup, glossary, sources, history, sync (collapsed).
- Primary actions stay visible or one click away. Right-click and long-press are extras (`NotesActionUi`: hover x, overflow menu, context menu).
- Breakpoint 768px. Phone: overlay panel, closed by default, no keyboard shortcuts except save. Desktop: side panel, resizable, open by default.
- Shortcuts: Ctrl/Cmd+S save+sync, Ctrl+E markdown export, Shift+F search, Shift+N new note.

## Knowledge packs
- AI context order: primary domain (explicit, then tags/keywords, then default), section outline, ranked Sources, glossary, related notes.
- Domains live in `KNOWLEDGE_DOMAINS` in `knowledge/registry.ts`: `uvimco-endowment`, `portfolio-quant`, `cfa-l1`, `general`.
- Override default with `NOTES_ACTIVE_DOMAIN`. Built-in packs seed into Sources on first load.
- New domain: add to `KNOWLEDGE_DOMAINS`, optionally `buildBuiltinSources()`.

## Verify
```bash
npm run verify:notes-triggers && npm run verify:notes-attachments && npm run verify:notes-tables && npm run type-check
lsof -ti:3001 | xargs kill -9 2>/dev/null; npm run test:e2e:notes
```
- Dev server 500 or missing `routes-manifest.json`: `rm -rf .next && npm run build`, retry.
- Deploy suite: `npm run test:e2e:notes-deploy`, `npm run smoke:notes-llm`.

## Gotchas
- Restore: `SyncPanel` calls `onSynced({ skipPersist: true })`, `refreshFromServer` must use `loadActiveSession()`.
- Screenshot paste must insert a `noteAttachment` node and dispatch `SCREENSHOT`.
- E2E editor selector: `[data-testid="notes-tiptap-editor"] .ProseMirror`.
