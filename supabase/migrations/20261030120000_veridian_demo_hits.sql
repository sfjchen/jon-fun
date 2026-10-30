-- Migration: shared rate-limit counter for the public Veridian demo at sfjc.dev/veridian.
-- Keys are hashed visitor IPs; rows older than a day are pruned on each hit.

create table if not exists veridian_demo_hits (
  key text not null,
  route text not null,
  at timestamptz not null default now()
);

create index if not exists idx_veridian_demo_hits_key on veridian_demo_hits(key, route, at);

alter table veridian_demo_hits enable row level security;

-- Records a hit and returns the exceeded cap label, or null when allowed.
create or replace function veridian_demo_hit(p_key text, p_route text, p_burst int, p_burst_min int, p_daily int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n_burst int;
  n_day int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key || p_route));
  delete from veridian_demo_hits where key = p_key and at < now() - interval '1 day';
  select count(*) filter (where at > now() - make_interval(mins => p_burst_min)), count(*)
    into n_burst, n_day
    from veridian_demo_hits where key = p_key and route = p_route;
  if n_burst >= p_burst then return 'burst'; end if;
  if n_day >= p_daily then return 'daily'; end if;
  insert into veridian_demo_hits (key, route) values (p_key, p_route);
  return null;
end;
$$;

revoke all on function veridian_demo_hit(text, text, int, int, int) from public, anon, authenticated;
