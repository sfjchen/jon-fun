-- Keeps the losing side of a same-day clash between 2 devices instead of dropping it.
-- daily_learn_entries.conflict holds the other device's text (several separated by newlines) until the user picks.
-- game_results.conflict holds a different finished game sent from another device under the same name:
-- { score, stats, device, at }. The first result still ranks.
alter table daily_learn_entries add column if not exists conflict text;
alter table game_results add column if not exists conflict jsonb;
