-- Rename legacy uvimco_note_sessions → note_sessions (Notes vault)
alter table if exists uvimco_note_sessions rename to note_sessions;

do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'idx_uvimco_note_sessions_user_updated'
  ) then
    alter index idx_uvimco_note_sessions_user_updated rename to idx_note_sessions_user_updated;
  end if;
end $$;
