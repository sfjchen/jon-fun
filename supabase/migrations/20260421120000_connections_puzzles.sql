-- Community Connections-style puzzles: public shelf via Next.js API + service role only.

create table if not exists public.connections_puzzles (
  id uuid primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  groups jsonb not null,
  tags text[] not null default '{}',
  author_display text not null default '',
  author_fingerprint text not null default '',
  play_count int not null default 0,
  solve_count int not null default 0,
  total_mistakes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connections_puzzles_updated_at_idx
  on public.connections_puzzles (updated_at desc);

create index if not exists connections_puzzles_play_count_idx
  on public.connections_puzzles (play_count desc);

create index if not exists connections_puzzles_slug_idx
  on public.connections_puzzles (slug);

alter table public.connections_puzzles enable row level security;

-- No anon/authenticated policies: access only via service role in API routes.

comment on table public.connections_puzzles is
  'User-created Connections-style puzzles (4 groups x 4 words). Public read/write through Next.js API with service role.';

-- Atomic stats increment (avoid read-modify-write races).
create or replace function public.connections_record_play(
  p_id uuid,
  p_solved boolean,
  p_mistakes int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.connections_puzzles
  set
    play_count = play_count + 1,
    solve_count = solve_count + case when p_solved then 1 else 0 end,
    total_mistakes = total_mistakes + greatest(0, least(4, coalesce(p_mistakes, 0))),
    updated_at = now()
  where id = p_id;
end;
$$;

comment on function public.connections_record_play(uuid, boolean, int) is
  'Increment play_count, optionally solve_count, and add clamped mistakes (0–4). Called from API with service role.';

revoke all on function public.connections_record_play(uuid, boolean, int) from public;
grant execute on function public.connections_record_play(uuid, boolean, int) to service_role;
