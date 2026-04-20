Site-wide e-reader catalog (optional)
=====================================

library-curated.json is a portable library (same shape as Export library (.json) from the studio).
When the communal Supabase shelf is not in use, it can be merged into this browser's IndexedDB (Indexed Database API)
when the visitor clicks "Load site catalog" (see bundled-library-seed.ts). The shared communal library does not
use this file.

Rules:
  - Use stable publication `id` values so updates replace the same shelf slot instead of duplicating.
  - Only ship works you have the legal right to redistribute publicly.
  - After editing this file, bump BUNDLED_READER_CATALOG_VERSION in src/lib/reader/bundled-library-seed.ts
    so existing users pull the new snapshot.

Build flow (operator): with the TINAD EPUB under e2e/fixtures/ (same filename as seed:reader-portable),
  npm run build:reader-curated
writes public/reader/library-curated.json (one book, stable id). Optional wiki Section I:
  npx tsx scripts/patch-tinad-wiki-section1-portable.ts public/reader/library-curated.json
Alternatively: npm run seed:reader-portable, vet, then copy the JSON slice you want into this path before deploy.
