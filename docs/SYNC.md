# Sync and devices

Daily Learn, Notes, Reader and Jeopardy's recent boards share 1 sync identity (`src/lib/syncIdentity.ts`, server `src/lib/syncAccess.ts`).

- Each browser has a device ID and at most 1 sync key in localStorage (`sfjc_device_id`, `sfjc_sync_key`).
  Typing the key once on a browser is all it needs. The key is the account: whoever sends it reads and writes it.
- The ids are mirrored to an HttpOnly cookie (`/api/sync/identity`, 400 days, refreshed every visit), which
  survives Safari's 7-day storage wipe.
- `sync_devices` ties each device ID to its key on the server. A device that comes back without its key gets it
  back from that row.
- Data with no key lives under the device ID.
- A device that links a key without a name takes the name the key's most recent device plays as, so its daily
  games follow the key. The link reply lists the key's other devices, which the Sync form shows.
- The owner key is `sfjc`. Owner-only features (Notes AI, Reader shelf deletes, Coming Soon tile, owner tags)
  check for it (`isOwnerKey` on the server, `isOwnerDevice` on the client).
- `SFJC_SYNC_PASSWORD` (Vercel env) is the retired owner password. The server maps it to `sfjc`.

Merge rules: Daily Learn keeps the newest `updatedAt` per day, with empty text as a delete tombstone. Devices on
the same account never conflict. Only the first sync after a device joins a sync key (no `daily_learn_synced:<key>`
flag yet) can: where the 2 histories hold a different text for a day, the newer shows and the other is kept in the
entry's `conflict` until the user picks in History. Notes keeps the newest session. Jeopardy recents
(`jeopardy_recents`) keep the newest visit per board, and a removal is a tombstone.

Everything else a browser keeps only in localStorage (game runs and archives, Spelling Bee words, reader progress,
bookmarks, annotations and hidden books, personal bests) is mirrored to `account_state` by `src/lib/stateSync.ts`
(`/api/sync/state`), started in `PageShell`. A new localStorage key that should follow the account goes in its
`PREFIXES` or `EXACT` list. The newest edit wins per entry, and entries a device held before its first sync count as
oldest, so a first sync only adds. Removed entries are not synced. Server rows are never expired. Sync never replaces either side. Daily games keep the first finished
result, and a different game sent from another device under the same name is stored in `game_results.conflict`
and shown beside it on the daily board.

Daily games sync by player name, not by sync key. Names are tidied where they are saved (`tidyName`: single
spaces, first letter capitalized) and matched without regard to case, and a device adopts the spelling its board
already holds on its next identity link. An open page pulls the name's Spelling Bee words on every live refresh
and checks for a day finished on another device each time the player returns to it.
