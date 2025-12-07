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

