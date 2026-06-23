-- Migration: Pear Navigator A/B sessions (progress + completions + dropouts)
-- Run after pear_navigator_ab. Adds sessions table for step-level tracking.

create table if not exists pear_navigator_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  variant text not null check (variant in ('a', 'b')),
  task_id text not null,
  step_reached int not null default 0,
  step_times jsonb default '[]',
  completed boolean not null default false,
  rating text check (rating is null or rating in ('meh', 'good', 'great')),
  total_sec int,
  steps_count int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pn_sessions_variant on pear_navigator_sessions(variant);
create index if not exists idx_pn_sessions_task on pear_navigator_sessions(task_id);
create index if not exists idx_pn_sessions_completed on pear_navigator_sessions(completed);
create index if not exists idx_pn_sessions_created on pear_navigator_sessions(created_at desc);

alter table pear_navigator_sessions enable row level security;
create policy "Allow public read" on pear_navigator_sessions for select using (true);
create policy "Allow anonymous insert" on pear_navigator_sessions for insert with check (true);
create policy "Allow anonymous update" on pear_navigator_sessions for update using (true);
