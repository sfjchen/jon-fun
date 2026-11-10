# Supabase schema (Jon-fun / sfjc.dev)

Project: **sfjchen's Project** (`nzviiorrlsdtwzvzodpg`).

## Canonical migrations

**Apply and track schema here:**

```
supabase/migrations/*.sql
```

- **`npm run db:migrations`** — compare local vs remote history (`supabase migration list --linked`)
- **`npm run db:push`** — apply pending migrations to linked remote (`supabase db push --linked --yes`)
- Agents: prefer Supabase MCP `apply_migration` for one-off remote DDL, but **commit the same SQL** under `supabase/migrations/` when it belongs in repo history.


## Notes vault tables

Applied via migrations `20260622120000` → `20260624120000`:

- `note_sessions` — synced note bodies, tags, metadata, lookups, screenshots
- `notes_sources` — reference docs / domain packs for AI context
- `notes_glossary` — auto-extracted terms

## Troubleshooting

**Remote-only migration versions** (applied in dashboard/MCP but missing locally) block `db push`. If the schema already matches a local file with a different timestamp:

```bash
supabase migration repair --status reverted <remote_version> --linked --yes
supabase migration repair --status applied <local_version> --linked --yes
```

**Never delete** files from `supabase/migrations/` that were applied to production without a repair plan.
