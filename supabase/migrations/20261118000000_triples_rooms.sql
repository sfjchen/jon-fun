-- Migration: rooms for Triples with Friends at sfjc.dev/games/triples.
-- One row per room holds the deck, the board and the players, so every claim is a single versioned update.
-- Read and written only by /api/triples (service role). Inactive rooms are deleted by /api/poker/cleanup.

create table if not exists triples_rooms (
  pin text primary key,
  host_id text not null,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished')),
  deck smallint[] not null default '{}',
  board smallint[] not null default '{}',
  players jsonb not null default '[]',
  last_claim jsonb,
  version integer not null default 0,
  started_at timestamptz,
  last_activity timestamptz not null default now()
);

alter table triples_rooms enable row level security;
