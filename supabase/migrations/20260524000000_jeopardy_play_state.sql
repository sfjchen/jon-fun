-- Per-board play state (teams, scores, used tiles) persisted alongside the board.
-- Separate CAS counter (play_version) so play ops don't conflict with board edits.

alter table public.jeopardy_boards
  add column if not exists play_state jsonb not null default jsonb_build_object(
    'teamCount', 2,
    'teams', jsonb_build_array(
      jsonb_build_object('name', 'Team 1', 'score', 0),
      jsonb_build_object('name', 'Team 2', 'score', 0)
    ),
    'used', '{}'::jsonb,
    'lastAnswered', null
  );

alter table public.jeopardy_boards
  add column if not exists play_version bigint not null default 0;

alter table public.jeopardy_boards
  add column if not exists play_updated_at timestamptz not null default now();

comment on column public.jeopardy_boards.play_state is
  'Shared play-time state (teams, scores, used tiles). Realtime-synced across devices via the same row.';
