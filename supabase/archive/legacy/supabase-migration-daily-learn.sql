-- Migration: 1 Sentence Everyday – daily_learn_entries
-- Steps: Supabase Dashboard → SQL Editor → New query → paste → Run

create extension if not exists "uuid-ossp";

-- 1 Sentence Everyday: one row per user per day (localStorage + Supabase sync)
create table if not exists daily_learn_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  text text not null default '',
  updated_at timestamptz default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_learn_entries_user_date on daily_learn_entries(user_id, date desc);
