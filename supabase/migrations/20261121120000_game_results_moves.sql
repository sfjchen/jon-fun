-- A result's checked moves, so a player who returns to a finished day on any device sees that game again.
-- Read only by /api/results/run, never by the leaderboard.
alter table game_results add column if not exists moves jsonb;
