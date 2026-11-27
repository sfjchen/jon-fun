-- Recent Jeopardy boards per sync account (the sync key, or the device ID for a browser with no key), so the
-- list on /games/jeopardy follows the account to every device. A removed row is a tombstone, so a board taken
-- off the list on 1 device stays off the others. Service role only (no RLS policies).
create table if not exists public.jeopardy_recents (
  user_id text not null,
  slug text not null,
  title text not null default '',
  visited_at timestamptz not null default now(),
  removed boolean not null default false,
  primary key (user_id, slug)
);

alter table public.jeopardy_recents enable row level security;
