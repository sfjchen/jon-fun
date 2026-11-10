-- Migration: per-device Spelling Bee progress at sfjc.dev/games/spelling-bee.
-- One row per device and puzzle (daily "YYYY-MM-DD:letters" or practice "p:letters"); scores only go up.

create table if not exists spelling_bee_plays (
  device text not null,
  puzzle text not null,
  words int not null default 0,
  score int not null default 0,
  max int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (device, puzzle)
);

create index if not exists idx_spelling_bee_plays_puzzle on spelling_bee_plays(puzzle);

alter table spelling_bee_plays enable row level security;

-- Records a device's best progress on a puzzle and returns the puzzle's player count and Genius count.
create or replace function spelling_bee_record(p_device text, p_puzzle text, p_words int, p_score int, p_max int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  res json;
begin
  if p_words > 0 then
    insert into spelling_bee_plays (device, puzzle, words, score, max)
      values (p_device, p_puzzle, p_words, p_score, p_max)
      on conflict (device, puzzle) do update
        set words = greatest(spelling_bee_plays.words, excluded.words),
            score = greatest(spelling_bee_plays.score, excluded.score),
            updated_at = now();
  end if;
  select json_build_object(
      'players', count(*),
      'genius', count(*) filter (where score >= round(0.7 * max))
    ) into res
    from spelling_bee_plays where puzzle = p_puzzle;
  return res;
end;
$$;

revoke all on function spelling_bee_record(text, text, int, int, int) from public, anon, authenticated;
