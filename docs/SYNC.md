# Sync and devices

Daily Learn, Notes and Reader share 1 sync identity (`src/lib/syncIdentity.ts`, server `src/lib/syncAccess.ts`).

- Each browser has a device ID and at most 1 sync key in localStorage (`sfjc_device_id`, `sfjc_sync_key`).
  Typing the key once on a browser is all it needs. The key is the account: whoever sends it reads and writes it.
- The ids are mirrored to an HttpOnly cookie (`/api/sync/identity`, 400 days, refreshed every visit), which
  survives Safari's 7-day storage wipe.
- `sync_devices` ties each device ID to its key on the server. A device that comes back without its key gets it
  back from that row.
- Data with no key lives under the device ID.
- The owner key is `sfjc`. Owner-only features (Notes AI, Reader shelf deletes, Coming Soon tile, owner tags)
  check for it (`isOwnerKey` on the server, `isOwnerDevice` on the client).
- `SFJC_SYNC_PASSWORD` (Vercel env) is the retired owner password. The server maps it to `sfjc`.

Merge rules: Daily Learn keeps the newest `updatedAt` per day, with empty text as a delete tombstone. Notes keeps
the newest session. Sync never replaces either side.
