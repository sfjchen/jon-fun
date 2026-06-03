-- Wedding RSVP responses for Madelyn & Patrick (sfjc.dev/wedding/madelyn-patrick)

create table if not exists public.wedding_rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  attending boolean not null,
  plus_one_name text,
  dietary text,
  email text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists wedding_rsvps_created_at_idx on public.wedding_rsvps (created_at desc);
create index if not exists wedding_rsvps_attending_idx on public.wedding_rsvps (attending);

alter table public.wedding_rsvps enable row level security;

-- No public read; writes go through API with service role
