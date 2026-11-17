-- Server-owned snapshots of public daily prompts and checked local answer banks.
create table if not exists public.daily_game_content (
  game text not null,
  source_day date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game, source_day)
);
alter table public.daily_game_content enable row level security;
-- No client policies: server service role only.
