-- A player's found Spelling Bee words, so every device under the same name shows the same found list.
-- Read only by /api/spelling-bee/words, never by the leaderboard.
alter table game_results add column if not exists words text[];
