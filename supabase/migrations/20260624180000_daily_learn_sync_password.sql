-- Unify 1 Sentence Everyday under owner sync password user id (was legacy "sfjc").
update daily_learn_entries
set user_id = 'REDACTED'
where user_id = 'sfjc';
