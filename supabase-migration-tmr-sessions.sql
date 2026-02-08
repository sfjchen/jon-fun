-- Migration: TMR session logging (study + sleep)
-- Target: PERSONAL project only → https://nzviiorrlsdtwzvzodpg.supabase.co
-- (Do not run on the class project ysfrxjztwprypybhsmcp.)
-- Steps: open personal project → SQL Editor → New query → paste this file → Run

create extension if not exists "uuid-ossp";

-- TMR study sessions (synced from client)
create table if not exists tmr_study_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  start timestamptz not null,
  "end" timestamptz not null,
  duration_minutes numeric not null,
  cues_played integer not null,
  cue_interval_seconds integer not null,
  interrupted boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_tmr_study_sessions_created_at on tmr_study_sessions(created_at desc);

-- TMR sleep sessions (synced from client)
create table if not exists tmr_sleep_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null,
  start timestamptz not null,
  "end" timestamptz not null,
  duration_minutes numeric not null,
  total_cues integer not null,
  cycles integer not null,
  created_at timestamptz default now()
);

create index if not exists idx_tmr_sleep_sessions_created_at on tmr_sleep_sessions(created_at desc);
