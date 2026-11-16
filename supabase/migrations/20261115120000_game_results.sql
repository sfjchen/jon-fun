-- Migration: daily game results for the Scores hub at sfjc.dev/leaderboards.
-- One row per group code, player name, game and day. Read and written only by /api/results (service role).

create table if not exists game_results (
  group_code text not null,
  name text not null,
  game text not null,
  day date not null,
  score int not null,
  detail text not null default '',
  created_at timestamptz not null default now(),
  primary key (group_code, name, game, day)
);

alter table game_results enable row level security;
