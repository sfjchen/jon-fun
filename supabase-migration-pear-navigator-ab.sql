-- Migration: Pear Navigator A/B test results
-- Steps: Supabase Dashboard → SQL Editor → New query → paste → Run

create extension if not exists "uuid-ossp";

create table if not exists pear_navigator_ab_results (
  id uuid primary key default gen_random_uuid(),
  variant text not null check (variant in ('a', 'b')),
  task_id text not null,
  rating text not null check (rating in ('meh', 'good', 'great')),
  total_sec int not null,
  avg_sec_per_step int not null,
  steps_count int not null,
  created_at timestamptz default now()
);

create index if not exists idx_pear_navigator_ab_variant on pear_navigator_ab_results(variant);
create index if not exists idx_pear_navigator_ab_task on pear_navigator_ab_results(task_id);
create index if not exists idx_pear_navigator_ab_created on pear_navigator_ab_results(created_at desc);

-- Allow anonymous read for results page (public data)
alter table pear_navigator_ab_results enable row level security;
create policy "Allow public read" on pear_navigator_ab_results for select using (true);
create policy "Allow anonymous insert" on pear_navigator_ab_results for insert with check (true);
