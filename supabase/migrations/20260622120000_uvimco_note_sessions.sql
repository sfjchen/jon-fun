-- UVIMCO AI Notes: multi-session history (localStorage + Supabase sync)
create table if not exists uvimco_note_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  session_id text not null,
  title text not null default '',
  notes text not null default '',
  lookups jsonb not null default '[]'::jsonb,
  screenshots jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  updated_at timestamptz default now(),
  unique (user_id, session_id)
);

create index if not exists idx_uvimco_note_sessions_user_updated
  on uvimco_note_sessions (user_id, updated_at desc);

alter table uvimco_note_sessions enable row level security;
