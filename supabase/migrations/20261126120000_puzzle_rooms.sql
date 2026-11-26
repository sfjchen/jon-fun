create table public.puzzle_rooms (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]{16}$'),
  puzzle jsonb not null,
  players jsonb not null,
  words jsonb not null default '[]',
  entries jsonb not null default '{}',
  solved boolean not null default false,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.puzzle_rooms enable row level security;
revoke all on public.puzzle_rooms from anon, authenticated;
grant select, insert, update, delete on public.puzzle_rooms to service_role;

create function public.notify_puzzle_room()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('version', new.version), 'sync', 'puzzle-room:' || new.id, false);
  return null;
end;
$$;

revoke all on function public.notify_puzzle_room() from public, anon, authenticated;

create trigger puzzle_room_updated
after update on public.puzzle_rooms
for each row
execute function public.notify_puzzle_room();
