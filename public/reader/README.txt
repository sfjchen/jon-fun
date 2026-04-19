Site-wide e-reader catalog (optional)
=====================================

library-curated.json is a portable library (same shape as Export library (.json) from the studio).
It is fetched by the e-reader page and merged into each visitor's browser IndexedDB when:

  - They have not yet synced this catalog VERSION (see bundled-library-seed.ts), or
  - They click "Load site catalog".

Rules:
  - Use stable publication `id` values so updates replace the same shelf slot instead of duplicating.
  - Only ship works you have the legal right to redistribute publicly.
  - After editing this file, bump BUNDLED_READER_CATALOG_VERSION in src/lib/reader/bundled-library-seed.ts
    so existing users pull the new snapshot.

Build flow (optional): generate a curated file locally (e.g. npm run seed:reader-portable), vet quality,
then copy into public/reader/library-curated.json before deploy.
