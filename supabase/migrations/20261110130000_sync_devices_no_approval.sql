-- Typing the sync key is enough, so device approval is gone. sync_devices now only ties each device to its key.
alter table sync_devices drop column if exists approved;
