-- Single-row home page "Coming Soon" copy (edited via POST /api/home/coming-soon + secret).

create table if not exists public.home_coming_soon_copy (
  id smallint primary key default 1 constraint home_coming_soon_copy_singleton check (id = 1),
  headline text not null,
  intro text not null,
  bullets text[] not null,
  updated_at timestamptz not null default now()
);

insert into public.home_coming_soon_copy (id, headline, intro, bullets)
values (
  1,
  'Coming Soon',
  'We''re working hard to bring you these exciting new features:',
  array[
    'Deeper Web E-Reader polish: cleaner imports, smoother offline reading, and sharper reading UX',
    'Small, repeatable local-first drills: typing speed, Zetamac-style arithmetic, and logic puzzles',
    'A few stronger experiments instead of a wider account/chat/friend-system surface',
    'Selective multiplayer polish only where it clearly improves actual game nights'
  ]::text[]
)
on conflict (id) do nothing;

alter table public.home_coming_soon_copy enable row level security;
