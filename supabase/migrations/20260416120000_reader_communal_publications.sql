-- Communal web e-reader shelf: one shared library per deployment (API uses service role).
-- Apply in Supabase SQL editor or via `supabase db push` when linked.

create table if not exists public.reader_communal_publications (
  id uuid primary key,
  title text not null,
  source_type text not null check (source_type in ('txt', 'paste', 'pdf', 'epub')),
  chapters jsonb not null,
  chapter_count int not null,
  total_words int not null,
  first_chapter_id text not null default '',
  original_file_name text,
  import_notes jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reader_communal_publications_updated_at_idx
  on public.reader_communal_publications (updated_at desc);

alter table public.reader_communal_publications enable row level security;

-- No anon/authenticated policies: access only via service role in API routes.

comment on table public.reader_communal_publications is
  'Shared e-reader publications (parsed text + chapters). Public read/write through Next.js API with service role; not exposed directly to PostgREST clients.';
