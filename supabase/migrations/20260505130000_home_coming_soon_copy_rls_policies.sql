-- home_coming_soon_copy: RLS was enabled without policies, blocking all anon/authenticated access.
-- Public site reads this row via GET /api/home/coming-soon (anon client when service role is absent).
-- Writes stay server-only: API route uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

create policy "home_coming_soon_copy_select_public"
  on public.home_coming_soon_copy
  for select
  to anon, authenticated
  using (true);
