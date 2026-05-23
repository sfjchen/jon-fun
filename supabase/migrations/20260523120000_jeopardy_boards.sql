-- Collaborative Jeopardy boards: realtime co-editing via Next.js API + service role only.

create table if not exists public.jeopardy_boards (
  id uuid primary key,
  slug text not null unique,
  title text not null default 'Untitled',
  board jsonb not null,
  base_value int not null default 200,
  increment int not null default 200,
  version bigint not null default 0,
  last_editor text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jeopardy_boards_slug_idx
  on public.jeopardy_boards (slug);

create index if not exists jeopardy_boards_updated_at_idx
  on public.jeopardy_boards (updated_at desc);

alter table public.jeopardy_boards enable row level security;

-- Realtime relies on the publication. Anon role needs SELECT on the row so postgres_changes
-- payloads flow to subscribed clients. Writes still gated by service-role API routes.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jeopardy_boards' and policyname = 'jeopardy_boards_select_all'
  ) then
    create policy jeopardy_boards_select_all
      on public.jeopardy_boards for select
      to anon, authenticated
      using (true);
  end if;
end$$;

-- Ensure the table is in the realtime publication (Supabase default name).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jeopardy_boards'
  ) then
    execute 'alter publication supabase_realtime add table public.jeopardy_boards';
  end if;
end$$;

comment on table public.jeopardy_boards is
  'Shared Jeopardy boards edited collaboratively via Next.js API (service role). Public read for realtime fan-out; no anon writes.';
