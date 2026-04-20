-- Optional per-publication reading position sync + ingest metadata (communal shelf).

alter table public.reader_communal_publications
  add column if not exists reading_state jsonb;

alter table public.reader_communal_publications
  add column if not exists ingest_meta jsonb;

comment on column public.reader_communal_publications.reading_state is
  'Last merged reading position (chapter, scroll, optional block anchor) for sync across devices.';
comment on column public.reader_communal_publications.ingest_meta is
  'Import pipeline confidence flags (optional; mirrors ReaderPublication.ingestMeta).';
