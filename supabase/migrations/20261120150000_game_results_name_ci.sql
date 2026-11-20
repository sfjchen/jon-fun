-- A board holds 1 row per player name regardless of case, so 2 devices posting "Jon" and "jon" at the same moment
-- cannot both file a row. /api/results already treats the unique violation as "this day is already filed".
create unique index if not exists game_results_name_ci_idx
  on public.game_results (group_code, lower(name), game, day, scoring_version);

-- Adds found Spelling Bee words to a player's row in 1 statement and returns the merged list, so 2 devices
-- syncing at once cannot drop each other's words. Called only by /api/results with the service role.
create or replace function public.merge_bee_words(
  p_group text, p_name text, p_day date, p_version integer, p_words text[]
) returns text[]
language sql
set search_path = ''
as $$
  update public.game_results
  set words = (select array_agg(distinct w order by w) from unnest(coalesce(words, '{}') || p_words) as w)
  where group_code = p_group and lower(name) = lower(p_name) and game = 'bee' and day = p_day
    and scoring_version = p_version
  returning words
$$;

revoke execute on function public.merge_bee_words(text, text, date, integer, text[]) from public, anon, authenticated;
grant execute on function public.merge_bee_words(text, text, date, integer, text[]) to service_role;
