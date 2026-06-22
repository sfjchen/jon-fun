-- Notes session metadata + Phase 2 memory bank
alter table uvimco_note_sessions
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists notes_sources (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default '',
  kind text not null default 'paste',
  content text not null default '',
  tags jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  include_in_context boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists idx_notes_sources_user_updated
  on notes_sources (user_id, updated_at desc);

create table if not exists notes_glossary (
  user_id text not null,
  term text not null,
  definition text not null default '',
  source_note_id text,
  source_lookup_id text,
  use_count int not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, term)
);

alter table notes_sources enable row level security;
alter table notes_glossary enable row level security;
