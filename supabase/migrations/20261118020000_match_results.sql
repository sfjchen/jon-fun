-- Migration: finished 24 and SET room matches for the Multiplayer tab at sfjc.dev/leaderboards.
-- One row per player per match. Read and written only by /api/match-results and the room routes (service role).

create table if not exists match_results (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('24', 'set')),
  room_pin text not null,
  room_started_at timestamptz not null,
  player_id text not null,
  player_name text not null,
  won boolean not null,
  rank int not null,
  score int not null,
  solve_ms_best int,
  solve_ms_avg int,
  sets_found int,
  misses int,
  played_at timestamptz not null default now(),
  unique (game, room_pin, room_started_at, player_id)
);

create index if not exists match_results_game_played_idx on match_results (game, played_at);

alter table match_results enable row level security;
