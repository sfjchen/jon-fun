# Sync and devices

Daily Learn, Notes and Reader share 1 sync identity (`src/lib/syncIdentity.ts`, server `src/lib/syncAccess.ts`).

- Each browser has a device ID and at most 1 sync key in localStorage (`sfjc_device_id`, `sfjc_sync_key`).
  Both are mirrored to an HttpOnly cookie (`/api/sync/identity`, 400 days, refreshed every visit), which survives
  Safari's 7-day storage wipe.
- `sync_devices` links each device ID to its key. A key's rows open only to approved devices, so a guessed key
  reads nothing. The first device of a brand-new key is approved at once. Any later device waits until an approved
  device approves it in Sync, or `npm run sync:devices -- approve pending`.
- Data with no key lives under the device ID and stays open to that device.
- The owner key is `sfjc`. Owner-only features (Notes AI, Reader shelf deletes, Coming Soon tile, owner tags)
  need an approved `sfjc` device (`isOwnerDevice`).
- `SFJC_SYNC_PASSWORD` (Vercel env) is the retired owner password. The server maps it to `sfjc` so old browsers
  join the owner key and wait for approval.

Merge rules: Daily Learn keeps the newest `updatedAt` per day, with empty text as a delete tombstone. Notes keeps
the newest session. Sync never replaces either side.
