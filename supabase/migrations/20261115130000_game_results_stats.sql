-- Migration: extra per-result facts for the Scores hub (play time, rank percent, first group solved, words found).

alter table game_results add column if not exists stats jsonb not null default '{}';
