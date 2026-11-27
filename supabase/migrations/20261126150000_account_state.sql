-- Mirror of the browser-only state (game runs and archives, reader progress, bookmarks and annotations, personal
-- bests) per sync account: the sync key, or the device ID for a browser with no key. It follows the account to
-- every device and survives a storage wipe. updated_at is the edit time on the device and decides which write
-- wins, saved_at is the server time devices page through. Service role only (no RLS policies).
create table if not exists public.account_state (
  user_id text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, key)
);

create index if not exists account_state_saved_idx on public.account_state (user_id, saved_at);

alter table public.account_state enable row level security;
