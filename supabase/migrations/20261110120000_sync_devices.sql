-- Links each browser's device ID to the sync key it entered. A key's data (Daily Learn, Notes) opens only to
-- approved devices, so a guessed or leaked key alone reads nothing. Service role only (no RLS policies).
create table if not exists sync_devices (
  device_id text primary key,
  sync_key text,
  approved boolean not null default false,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists sync_devices_sync_key_idx on sync_devices (sync_key);

alter table sync_devices enable row level security;
