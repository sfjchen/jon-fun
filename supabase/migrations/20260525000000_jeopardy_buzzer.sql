-- Latency-fair buzzer for Jeopardy lobbies.
--
-- Three tables:
--   jeopardy_buzzer_sessions  (one per board, owns the PIN + arm/lock state)
--   jeopardy_buzzer_players   (per-device join + measured clock offset)
--   jeopardy_buzzes           (one row per buzz; ordered by effective_server_press_at)
--
-- One atomic RPC: jeopardy_record_buzz — validates round, computes effective press time,
-- inserts (idempotent on the round_id,player_id unique index), and recomputes ranks.

create table if not exists public.jeopardy_buzzer_sessions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.jeopardy_boards(id) on delete cascade,
  pin text not null unique,
  status text not null default 'idle' check (status in ('idle', 'armed', 'locked')),
  armed_at timestamptz,
  locked_at timestamptz,
  current_round_id uuid,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (board_id)
);

create index if not exists jeopardy_buzzer_sessions_pin_idx on public.jeopardy_buzzer_sessions (pin);

create table if not exists public.jeopardy_buzzer_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.jeopardy_buzzer_sessions(id) on delete cascade,
  player_id uuid not null,
  name text not null default 'Player',
  color text not null default '#3b82f6',
  clock_offset_ms int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (session_id, player_id)
);

create index if not exists jeopardy_buzzer_players_session_idx on public.jeopardy_buzzer_players (session_id);

create table if not exists public.jeopardy_buzzes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.jeopardy_buzzer_sessions(id) on delete cascade,
  round_id uuid not null,
  player_id uuid not null,
  name text not null default 'Player',
  color text not null default '#3b82f6',
  client_press_at timestamptz not null,
  server_receive_at timestamptz not null,
  effective_server_press_at timestamptz not null,
  accepted boolean not null default true,
  reject_reason text,
  rank int,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create index if not exists jeopardy_buzzes_round_order_idx
  on public.jeopardy_buzzes (round_id, effective_server_press_at);
create index if not exists jeopardy_buzzes_session_idx on public.jeopardy_buzzes (session_id);

-- ----- RLS: anon SELECT, writes only via service-role API routes (matches jeopardy_boards pattern) -----

alter table public.jeopardy_buzzer_sessions enable row level security;
alter table public.jeopardy_buzzer_players enable row level security;
alter table public.jeopardy_buzzes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jeopardy_buzzer_sessions' and policyname = 'jeopardy_buzzer_sessions_select_all'
  ) then
    create policy jeopardy_buzzer_sessions_select_all
      on public.jeopardy_buzzer_sessions for select
      to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jeopardy_buzzer_players' and policyname = 'jeopardy_buzzer_players_select_all'
  ) then
    create policy jeopardy_buzzer_players_select_all
      on public.jeopardy_buzzer_players for select
      to anon, authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'jeopardy_buzzes' and policyname = 'jeopardy_buzzes_select_all'
  ) then
    create policy jeopardy_buzzes_select_all
      on public.jeopardy_buzzes for select
      to anon, authenticated using (true);
  end if;
end$$;

-- ----- Realtime publication: fan-out all three tables -----

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jeopardy_buzzer_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.jeopardy_buzzer_sessions';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jeopardy_buzzer_players'
  ) then
    execute 'alter publication supabase_realtime add table public.jeopardy_buzzer_players';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jeopardy_buzzes'
  ) then
    execute 'alter publication supabase_realtime add table public.jeopardy_buzzes';
  end if;
end$$;

-- ----- Atomic buzz recorder -----
--
-- Takes the session's lock, validates round is armed, computes effective_server_press_at
-- with sanity clamps, inserts the buzz row (idempotent via the unique index — duplicate
-- second taps return the existing row), recomputes ranks for the round, returns the queue.
--
-- Inputs use raw ms timestamps to avoid client-side timezone surprises.
--   _client_press_ms : Date.now() at the moment the player tapped
--   _server_receive_ms : Date.now() at the API route the instant the POST landed
--   _clock_offset_ms : last-measured (client → server) offset for this player
--
-- The (round_id, player_id) unique index makes duplicate POSTs silent no-ops (returns
-- existing row's rank) so flaky-network retries from the client don't double-buzz.

create or replace function public.jeopardy_record_buzz(
  _session_id uuid,
  _player_id uuid,
  _player_name text,
  _player_color text,
  _client_press_ms bigint,
  _server_receive_ms bigint,
  _clock_offset_ms int
) returns table (
  id uuid,
  round_id uuid,
  player_id uuid,
  name text,
  color text,
  client_press_at timestamptz,
  server_receive_at timestamptz,
  effective_server_press_at timestamptz,
  rank int,
  accepted boolean,
  reject_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _session record;
  _client_press_ts timestamptz;
  _server_receive_ts timestamptz;
  _effective_ts timestamptz;
  _armed_at timestamptz;
  _offset_ms int;
  _clamped_press_ms bigint;
begin
  -- Lock the session row for the duration of this txn.
  select * into _session
    from public.jeopardy_buzzer_sessions
   where jeopardy_buzzer_sessions.id = _session_id
   for update;

  if not found then
    return query select
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz,
      null::int, false, 'session_not_found'::text;
    return;
  end if;

  if _session.status <> 'armed' or _session.current_round_id is null then
    return query select
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      null::timestamptz, null::timestamptz, null::timestamptz,
      null::int, false, 'round_not_armed'::text;
    return;
  end if;

  _armed_at := _session.armed_at;
  _offset_ms := greatest(-30000, least(30000, coalesce(_clock_offset_ms, 0)));

  _client_press_ts := to_timestamp(_client_press_ms::double precision / 1000.0);
  _server_receive_ts := to_timestamp(_server_receive_ms::double precision / 1000.0);

  -- effective = client_press + offset (the moment of press, expressed on the server clock)
  _clamped_press_ms := _client_press_ms + _offset_ms;

  -- Clamp "future" timestamps (claimed press > server receive + 100ms) to the receive time
  -- so a manipulated/skewed client clock can't claim an earlier press than physically possible.
  if _clamped_press_ms > _server_receive_ms + 100 then
    _clamped_press_ms := _server_receive_ms;
  end if;

  _effective_ts := to_timestamp(_clamped_press_ms::double precision / 1000.0);

  -- Reject buzzes that "happened" before the round was armed.
  if _armed_at is not null and _effective_ts < _armed_at - interval '100 milliseconds' then
    return query select
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      _client_press_ts, _server_receive_ts, _effective_ts,
      null::int, false, 'pressed_before_armed'::text;
    return;
  end if;

  -- Idempotent insert: if this (round, player) already exists, do nothing.
  insert into public.jeopardy_buzzes (
    session_id, round_id, player_id, name, color,
    client_press_at, server_receive_at, effective_server_press_at, accepted
  ) values (
    _session_id, _session.current_round_id, _player_id,
    coalesce(nullif(trim(_player_name), ''), 'Player'),
    coalesce(nullif(trim(_player_color), ''), '#3b82f6'),
    _client_press_ts, _server_receive_ts, _effective_ts, true
  )
  on conflict (round_id, player_id) do nothing;

  -- Recompute ranks 1..N over the round in (effective_server_press_at, server_receive_at) order.
  with ranked as (
    select b.id,
           row_number() over (order by b.effective_server_press_at asc, b.server_receive_at asc) as rk
      from public.jeopardy_buzzes b
     where b.round_id = _session.current_round_id and b.accepted
  )
  update public.jeopardy_buzzes b
     set rank = ranked.rk
    from ranked
   where b.id = ranked.id and (b.rank is distinct from ranked.rk);

  return query
    select b.id, b.round_id, b.player_id, b.name, b.color,
           b.client_press_at, b.server_receive_at, b.effective_server_press_at,
           b.rank, b.accepted, b.reject_reason
      from public.jeopardy_buzzes b
     where b.round_id = _session.current_round_id
     order by coalesce(b.rank, 99999), b.effective_server_press_at;
end;
$$;

revoke all on function public.jeopardy_record_buzz(uuid, uuid, text, text, bigint, bigint, int) from public;
grant execute on function public.jeopardy_record_buzz(uuid, uuid, text, text, bigint, bigint, int) to anon, authenticated, service_role;

comment on function public.jeopardy_record_buzz is
  'Atomic buzz recorder: validates session is armed, applies effective_press_at = client_press + offset (with sanity clamps), inserts idempotently on (round_id,player_id), recomputes ranks, returns full round queue.';

comment on table public.jeopardy_buzzer_sessions is
  'Per-board buzzer session. PIN-keyed lobby; status arm/clear/lock controlled by host. Realtime fan-out enabled.';
comment on table public.jeopardy_buzzer_players is
  'Per-device join row for a buzzer session. Stores measured clock_offset_ms (client → server) refreshed periodically.';
comment on table public.jeopardy_buzzes is
  'One row per buzz. Ordered by effective_server_press_at (client press time translated to server clock) — fan-out via realtime.';
