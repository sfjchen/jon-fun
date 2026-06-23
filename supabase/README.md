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

## Legacy manual SQL (archived)

Pre–CLI migrations and one-off game schemas live under:

```
supabase/archive/legacy/
```

These files are **not** run by `db push`. They were applied manually (SQL Editor or ad-hoc scripts) before the repo standardized on `supabase/migrations/`.

| File | Feature |
|------|---------|
| `party-games.sql` | Quip Clash, Fib It, Enough About You (`party_rooms`, …) |
| `daily-learn.sql` | 1 Sentence Everyday (`daily_learn_entries`) |
| `game24.sql` | Game 24 multiplayer |
| `tmr-sessions.sql` | TMR study/sleep sessions |
| `pear-navigator-ab.sql` / `pear-navigator-sessions.sql` | Pear Navigator A/B |
| `add-last-activity.sql` | Room activity timestamps |

Keep for reference and fresh-env bootstrap; copy into a new timestamped file under `supabase/migrations/` only if you need them in automated push history.

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
