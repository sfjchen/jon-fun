-- Migration: Party games (Quiplash-like, Fibbage-like, Enough About You-like)
-- Run after uuid extension exists (see game24 migration).

create extension if not exists "uuid-ossp";

-- --- Shared ---
create table if not exists party_rooms (
  id uuid primary key default uuid_generate_v4(),
  pin text not null unique,
  host_id uuid,
  game_kind text not null check (game_kind in ('quiplash', 'fibbage', 'eay')),
  phase text not null default 'lobby',
  round_index integer not null default 0,
  step_index integer not null default 0,
  deadline_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  max_players integer not null default 8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity timestamptz not null default now()
);

create index if not exists idx_party_rooms_last_activity on party_rooms(last_activity);
create index if not exists idx_party_rooms_game_kind on party_rooms(game_kind);

create table if not exists party_players (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  player_id uuid not null,
  name text not null,
  score integer not null default 0,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now()
);

create unique index if not exists party_players_room_player on party_players(room_pin, player_id);
create index if not exists party_players_room_pin on party_players(room_pin);

-- --- Quiplash-like ---
create table if not exists party_quiplash_matchups (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  round_index integer not null,
  sort_order integer not null,
  prompt_text text not null,
  player_a uuid not null,
  player_b uuid not null
);

create index if not exists party_quiplash_matchups_room on party_quiplash_matchups(room_pin, round_index);

create table if not exists party_quiplash_answers (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  round_index integer not null,
  matchup_id uuid not null references party_quiplash_matchups(id) on delete cascade,
  player_id uuid not null,
  body text not null,
  submitted_at timestamptz not null default now(),
  unique (matchup_id, player_id)
);

create table if not exists party_quiplash_votes (
  id uuid primary key default uuid_generate_v4(),
  matchup_id uuid not null references party_quiplash_matchups(id) on delete cascade,
  voter_player_id uuid not null,
  choice smallint not null check (choice in (0, 1)),
  unique (matchup_id, voter_player_id)
);

create table if not exists party_quiplash_final_prompt (
  room_pin text primary key references party_rooms(pin) on delete cascade,
  prompt_text text not null,
  round_index integer not null default 3
);

create table if not exists party_quiplash_final_answers (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  player_id uuid not null,
  body text not null,
  unique (room_pin, player_id)
);

create table if not exists party_quiplash_final_votes (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  voter_player_id uuid not null,
  slot integer not null check (slot >= 1 and slot <= 3),
  target_player_id uuid not null,
  unique (room_pin, voter_player_id, slot)
);

-- --- Fibbage-like ---
create table if not exists party_fibbage_rounds (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  round_index integer not null,
  category text not null,
  prompt_template text not null,
  truth text not null,
  option_order jsonb,
  picker_player_id uuid,
  unique (room_pin, round_index)
);

create index if not exists party_fibbage_rounds_room on party_fibbage_rounds(room_pin);

create table if not exists party_fibbage_lies (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_fibbage_rounds(id) on delete cascade,
  player_id uuid not null,
  lie_text text not null,
  from_suggestion boolean not null default false,
  unique (round_id, player_id)
);

create table if not exists party_fibbage_picks (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_fibbage_rounds(id) on delete cascade,
  player_id uuid not null,
  picked_index integer not null,
  unique (round_id, player_id)
);

create table if not exists party_fibbage_likes (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_fibbage_rounds(id) on delete cascade,
  from_player_id uuid not null,
  to_player_id uuid not null,
  unique (round_id, from_player_id, to_player_id)
);

-- --- Enough About You-like ---
create table if not exists party_eay_intake (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  player_id uuid not null,
  question_id text not null,
  answer text not null,
  unique (room_pin, player_id, question_id)
);

create index if not exists party_eay_intake_room on party_eay_intake(room_pin);

create table if not exists party_eay_rounds (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  round_index integer not null,
  subject_player_id uuid not null,
  question_id text not null,
  question_template text not null,
  truth text not null,
  option_order jsonb,
  unique (room_pin, round_index)
);

create table if not exists party_eay_lies (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_eay_rounds(id) on delete cascade,
  player_id uuid not null,
  lie_text text not null,
  from_suggestion boolean not null default false,
  unique (round_id, player_id)
);

create table if not exists party_eay_picks (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_eay_rounds(id) on delete cascade,
  player_id uuid not null,
  picked_index integer not null,
  unique (round_id, player_id)
);

create table if not exists party_eay_likes (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references party_eay_rounds(id) on delete cascade,
  from_player_id uuid not null,
  to_player_id uuid not null,
  unique (round_id, from_player_id, to_player_id)
);

create table if not exists party_eay_final (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  player_id uuid not null,
  truth_text text not null,
  lie_text text not null,
  unique (room_pin, player_id)
);

create table if not exists party_eay_final_picks (
  id uuid primary key default uuid_generate_v4(),
  room_pin text not null references party_rooms(pin) on delete cascade,
  voter_player_id uuid not null,
  subject_player_id uuid not null,
  choice_index smallint not null check (choice_index in (0, 1)),
  unique (room_pin, voter_player_id, subject_player_id)
);

-- RLS (permissive, anon-friendly like game24)
alter table party_rooms enable row level security;
alter table party_players enable row level security;
alter table party_quiplash_matchups enable row level security;
alter table party_quiplash_answers enable row level security;
alter table party_quiplash_votes enable row level security;
alter table party_quiplash_final_prompt enable row level security;
alter table party_quiplash_final_answers enable row level security;
alter table party_quiplash_final_votes enable row level security;
alter table party_fibbage_rounds enable row level security;
alter table party_fibbage_lies enable row level security;
alter table party_fibbage_picks enable row level security;
alter table party_fibbage_likes enable row level security;
alter table party_eay_intake enable row level security;
alter table party_eay_rounds enable row level security;
alter table party_eay_lies enable row level security;
alter table party_eay_picks enable row level security;
alter table party_eay_likes enable row level security;
alter table party_eay_final enable row level security;
alter table party_eay_final_picks enable row level security;

do $$ begin
  perform 1;
  -- party_rooms
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_rooms' and policyname = 'party rooms select') then
    create policy "party rooms select" on party_rooms for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_rooms' and policyname = 'party rooms insert') then
    create policy "party rooms insert" on party_rooms for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_rooms' and policyname = 'party rooms update') then
    create policy "party rooms update" on party_rooms for update to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_rooms' and policyname = 'party rooms delete') then
    create policy "party rooms delete" on party_rooms for delete to public using (true);
  end if;
  -- party_players
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_players' and policyname = 'party players select') then
    create policy "party players select" on party_players for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_players' and policyname = 'party players insert') then
    create policy "party players insert" on party_players for insert to public with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_players' and policyname = 'party players update') then
    create policy "party players update" on party_players for update to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_players' and policyname = 'party players delete') then
    create policy "party players delete" on party_players for delete to public using (true);
  end if;
  -- quiplash
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_matchups' and policyname = 'party quiplash matchups all') then
    create policy "party quiplash matchups all" on party_quiplash_matchups for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_answers' and policyname = 'party quiplash answers all') then
    create policy "party quiplash answers all" on party_quiplash_answers for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_votes' and policyname = 'party quiplash votes all') then
    create policy "party quiplash votes all" on party_quiplash_votes for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_final_prompt' and policyname = 'party quiplash final prompt all') then
    create policy "party quiplash final prompt all" on party_quiplash_final_prompt for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_final_answers' and policyname = 'party quiplash final answers all') then
    create policy "party quiplash final answers all" on party_quiplash_final_answers for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_quiplash_final_votes' and policyname = 'party quiplash final votes all') then
    create policy "party quiplash final votes all" on party_quiplash_final_votes for all to public using (true) with check (true);
  end if;
  -- fibbage
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_fibbage_rounds' and policyname = 'party fibbage rounds all') then
    create policy "party fibbage rounds all" on party_fibbage_rounds for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_fibbage_lies' and policyname = 'party fibbage lies all') then
    create policy "party fibbage lies all" on party_fibbage_lies for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_fibbage_picks' and policyname = 'party fibbage picks all') then
    create policy "party fibbage picks all" on party_fibbage_picks for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_fibbage_likes' and policyname = 'party fibbage likes all') then
    create policy "party fibbage likes all" on party_fibbage_likes for all to public using (true) with check (true);
  end if;
  -- eay
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_intake' and policyname = 'party eay intake all') then
    create policy "party eay intake all" on party_eay_intake for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_rounds' and policyname = 'party eay rounds all') then
    create policy "party eay rounds all" on party_eay_rounds for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_lies' and policyname = 'party eay lies all') then
    create policy "party eay lies all" on party_eay_lies for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_picks' and policyname = 'party eay picks all') then
    create policy "party eay picks all" on party_eay_picks for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_likes' and policyname = 'party eay likes all') then
    create policy "party eay likes all" on party_eay_likes for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_final' and policyname = 'party eay final all') then
    create policy "party eay final all" on party_eay_final for all to public using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'party_eay_final_picks' and policyname = 'party eay final picks all') then
    create policy "party eay final picks all" on party_eay_final_picks for all to public using (true) with check (true);
  end if;
end $$;
