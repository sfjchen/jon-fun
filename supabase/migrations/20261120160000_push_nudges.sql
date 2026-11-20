-- Push subscriptions for friend nudges, 1 row per browser endpoint, filed under the board name the browser plays as.
-- A nudge row records who nudged whom on a day, so each friend gets at most 1 nudge per sender per day.
-- Read and written only by /api/push/* (service role, no RLS policies).
create table if not exists push_subscriptions (
  endpoint text primary key,
  group_code text not null,
  name text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_player_idx on push_subscriptions (group_code, lower(name));
alter table push_subscriptions enable row level security;

create table if not exists nudges (
  group_code text not null,
  from_name text not null,
  to_name text not null,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (group_code, from_name, to_name, day)
);
alter table nudges enable row level security;
