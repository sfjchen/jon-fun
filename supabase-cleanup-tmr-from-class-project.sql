-- Optional: Remove TMR tables from the CLASS project only
-- Target: https://ysfrxjztwprypybhsmcp.supabase.co (class project)
-- Use this if you want to keep the class project free of jon-fun TMR tables.
-- Steps: open CLASS project → SQL Editor → New query → paste → Run

drop index if exists idx_tmr_study_sessions_created_at;
drop index if exists idx_tmr_sleep_sessions_created_at;
drop table if exists tmr_study_sessions;
drop table if exists tmr_sleep_sessions;
