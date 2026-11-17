-- Keep earlier local scoring history separate from scores using the original rules.
alter table public.game_results add column if not exists scoring_version integer not null default 1;
alter table public.game_results drop constraint if exists game_results_pkey;
alter table public.game_results add primary key (group_code, name, game, day, scoring_version);
-- Existing Mini results already recorded their true solve time; retain those first completions.
update public.game_results
set score=(stats->>'seconds')::integer,
    scoring_version=2,
    stats=stats || '{"scoringVersion":2}'::jsonb
where game='mini' and scoring_version=1
  and stats->>'seconds' ~ '^[0-9]{1,6}$';
-- Convert only Connections rows whose recorded facts establish the actual groups/mistakes.
update public.game_results
set score=(stats->>'n')::integer,
    scoring_version=2,
    stats=stats || '{"scoringVersion":2}'::jsonb
where game='connections' and scoring_version=1
  and stats->>'n' ~ '^[0-4]$' and stats->>'mistakes' ~ '^[0-4]$';
