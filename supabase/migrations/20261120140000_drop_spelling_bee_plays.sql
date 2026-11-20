-- The Spelling Bee player count now reads game_results, so the per-browser play log and its function are unused.
drop function if exists spelling_bee_record(text, text, int, int, int);
drop table if exists spelling_bee_plays;
