-- Fix: function OUT-param names (id, round_id, player_id, name, color, rank, …) collided
-- with table column references inside the rank-recompute CTE, raising
-- "column reference \"round_id\" is ambiguous". Rewrite with explicit table qualifiers
-- and use `#variable_conflict use_column` so unqualified names always mean the table column.

drop function if exists public.jeopardy_record_buzz(uuid, uuid, text, text, bigint, bigint, int);

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
#variable_conflict use_column
declare
  _session record;
  _client_press_ts timestamptz;
  _server_receive_ts timestamptz;
  _effective_ts timestamptz;
  _armed_at timestamptz;
  _offset_ms int;
  _clamped_press_ms bigint;
  _round_id uuid;
begin
  select * into _session
    from public.jeopardy_buzzer_sessions s
   where s.id = _session_id
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
  _round_id := _session.current_round_id;
  _offset_ms := greatest(-30000, least(30000, coalesce(_clock_offset_ms, 0)));

  _client_press_ts := to_timestamp(_client_press_ms::double precision / 1000.0);
  _server_receive_ts := to_timestamp(_server_receive_ms::double precision / 1000.0);

  _clamped_press_ms := _client_press_ms + _offset_ms;

  if _clamped_press_ms > _server_receive_ms + 100 then
    _clamped_press_ms := _server_receive_ms;
  end if;

  _effective_ts := to_timestamp(_clamped_press_ms::double precision / 1000.0);

  if _armed_at is not null and _effective_ts < _armed_at - interval '100 milliseconds' then
    return query select
      null::uuid, null::uuid, null::uuid, null::text, null::text,
      _client_press_ts, _server_receive_ts, _effective_ts,
      null::int, false, 'pressed_before_armed'::text;
    return;
  end if;

  insert into public.jeopardy_buzzes (
    session_id, round_id, player_id, name, color,
    client_press_at, server_receive_at, effective_server_press_at, accepted
  ) values (
    _session_id, _round_id, _player_id,
    coalesce(nullif(trim(_player_name), ''), 'Player'),
    coalesce(nullif(trim(_player_color), ''), '#3b82f6'),
    _client_press_ts, _server_receive_ts, _effective_ts, true
  )
  on conflict (round_id, player_id) do nothing;

  with ranked as (
    select b.id as bid,
           row_number() over (order by b.effective_server_press_at asc, b.server_receive_at asc) as rk
      from public.jeopardy_buzzes b
     where b.round_id = _round_id and b.accepted
  )
  update public.jeopardy_buzzes b
     set rank = ranked.rk
    from ranked
   where b.id = ranked.bid and (b.rank is distinct from ranked.rk);

  return query
    select b.id, b.round_id, b.player_id, b.name, b.color,
           b.client_press_at, b.server_receive_at, b.effective_server_press_at,
           b.rank, b.accepted, b.reject_reason
      from public.jeopardy_buzzes b
     where b.round_id = _round_id
     order by coalesce(b.rank, 99999), b.effective_server_press_at;
end;
$$;

revoke all on function public.jeopardy_record_buzz(uuid, uuid, text, text, bigint, bigint, int) from public;
grant execute on function public.jeopardy_record_buzz(uuid, uuid, text, text, bigint, bigint, int) to anon, authenticated, service_role;
