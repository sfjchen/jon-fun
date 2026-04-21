-- Anchored discussion threads on communal e-reader paragraphs (block_id matches data-block-id / b-{chapterId}-p{n}).
-- Access only via Next.js API + service role (same model as reader_communal_publications).

create table if not exists public.reader_publication_comments (
  id uuid primary key default gen_random_uuid(),
  publication_id text not null,
  chapter_id text not null,
  block_id text not null,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  author_display text not null check (char_length(author_display) >= 1 and char_length(author_display) <= 64),
  author_fingerprint text not null,
  created_at timestamptz not null default now()
);

create index if not exists reader_publication_comments_pub_chapter_idx
  on public.reader_publication_comments (publication_id, chapter_id);

create index if not exists reader_publication_comments_block_idx
  on public.reader_publication_comments (publication_id, block_id);

create index if not exists reader_publication_comments_created_idx
  on public.reader_publication_comments (created_at desc);

alter table public.reader_publication_comments enable row level security;

comment on table public.reader_publication_comments is
  'Per-paragraph reader notes; public read/write through Next.js with service role. author_fingerprint is a stable client id; author_display is the shown name.';
