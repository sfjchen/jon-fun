-- Tags each daily result with the kind of device that played it (phone, tablet or computer), so a player who
-- shares 1 name across devices can compare how they score on each. Devices report their kind on every visit,
-- which also tags their earlier untagged results.
alter table game_results add column if not exists device_kind text check (device_kind in ('phone', 'tablet', 'computer'));
alter table sync_devices add column if not exists device_kind text check (device_kind in ('phone', 'tablet', 'computer'));
