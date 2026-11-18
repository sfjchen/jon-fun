-- A device's remembered game name also labels future log and note edits.
alter table sync_devices add column if not exists player_name text not null default '';
alter table sync_devices add column if not exists player_group text not null default 'public';
alter table game_results add column if not exists device_id text;
create index if not exists game_results_device_idx on game_results(device_id) where device_id is not null;
