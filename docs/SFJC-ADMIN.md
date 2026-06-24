# sfjc.dev — owner sync & admin devices

Reference for Jon's personal cross-device setup on sfjc.dev.

## Sync password

- **UI label:** sync password (not "sync key")
- **Owner password user id:** `MLpnko#12` — all synced notes + daily-log data merge under this id on Supabase
- **Server env:** `SFJC_SYNC_PASSWORD=MLpnko#12` on production (Vercel). Required for Notes AI lookup/embed.
- **localStorage keys (unchanged for compat):** `notes_sync_key`, `daily_learn_sync_key`

### On each device

1. Open **Notes** → panel → **Sync & backup** → enter sync password → **Save & Sync**
2. Open **1 Sentence Everyday** → **Sync** tab → same password → **Save & Sync**

## Admin devices (2026-06-24)

| Device | `notes_user_id` / device UUID |
|--------|-------------------------------|
| Jonathan's iPhone | `1d6c04b1-42d0-44ed-bcd1-c9b48ffcaffc` |
| Jonathan's Macbook Air | `d6e8099c-7873-40e9-88f5-e6601001ec0a` |
| Jonathan's Work Laptop | `81a932d2-de6b-42a5-a2b5-274a9141c668` |

Source of truth in code: [`src/data/sfjc-admin-devices.ts`](../src/data/sfjc-admin-devices.ts).

Use admin device ids for future owner-only admin routes, debugging, and agent context.

## Notes AI access

- **`POST /api/notes/lookup`** and **`POST /api/notes/embed`** require a valid sync password in the request body when `SFJC_SYNC_PASSWORD` is set.
- Without the password, API returns **403** with the standard denial message.
- Client sends `syncPassword` from localStorage + `deviceUserId` for auditing.

## Daily log migration

Historical entries under user id `sfjc` were migrated to `MLpnko#12` (see `supabase/migrations/20260624180000_daily_learn_sync_password.sql`).
