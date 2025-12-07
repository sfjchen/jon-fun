-- Migration: Game24 online multiplayer
-- Tables: game24_rooms, game24_players, game24_rounds, game24_submissions

create extension if not exists "uuid-ossp";

create table if not exists game24_rooms (
  id uuid primary key default uuid_generate_v4(),
  pin text not null unique,
  host_id uuid,
  status text not null default 'waiting', -- waiting | active | intermission | finished
  round_number integer not null default 0,
  current_round_started_at timestamptz,
  intermission_until timestamptz,
  max_players integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create index if not exists idx_game24_rooms_last_activity on game24_rooms(last_activity);

create table if not exists game24_players (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references game24_rooms(pin) on delete cascade,
  player_id uuid not null,
  name text not null,
  score integer not null default 0,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now()
);

create unique index if not exists game24_players_room_pin_player_id_key on game24_players(room_pin, player_id);

create table if not exists game24_rounds (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references game24_rooms(pin) on delete cascade,
  round_number integer not null,
  numbers integer[] not null,
  started_at timestamptz not null default now()
);

create unique index if not exists game24_rounds_room_pin_round_number_key on game24_rounds(room_pin, round_number);

create table if not exists game24_submissions (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references game24_rooms(pin) on delete cascade,
  round_number integer not null,
  player_id uuid not null,
  expression text not null,
  is_correct boolean not null default false,
  score_awarded integer not null default 0,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_game24_submissions_room_round on game24_submissions(room_pin, round_number);
create index if not exists idx_game24_submissions_player_round on game24_submissions(player_id, round_number);

-- RLS policies (permissive, anon-friendly like poker)
alter table game24_rooms enable row level security;
alter table game24_players enable row level security;
alter table game24_rounds enable row level security;
alter table game24_submissions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_rooms' and policyname = 'game24 rooms select') then
    create policy "game24 rooms select" on game24_rooms for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_rooms' and policyname = 'game24 rooms insert') then
    create policy "game24 rooms insert" on game24_rooms for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_rooms' and policyname = 'game24 rooms update') then
    create policy "game24 rooms update" on game24_rooms for update to public using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_players' and policyname = 'game24 players select') then
    create policy "game24 players select" on game24_players for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_players' and policyname = 'game24 players insert') then
    create policy "game24 players insert" on game24_players for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_players' and policyname = 'game24 players update') then
    create policy "game24 players update" on game24_players for update to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_players' and policyname = 'game24 players delete') then
    create policy "game24 players delete" on game24_players for delete to public using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_rounds' and policyname = 'game24 rounds select') then
    create policy "game24 rounds select" on game24_rounds for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_rounds' and policyname = 'game24 rounds insert') then
    create policy "game24 rounds insert" on game24_rounds for insert to public with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_submissions' and policyname = 'game24 submissions select') then
    create policy "game24 submissions select" on game24_submissions for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'game24_submissions' and policyname = 'game24 submissions insert') then
    create policy "game24 submissions insert" on game24_submissions for insert to public with check (true);
  end if;
end $$;

