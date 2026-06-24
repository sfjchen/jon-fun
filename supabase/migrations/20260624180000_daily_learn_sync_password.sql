-- Unify 1 Sentence Everyday under owner sync password user id (was legacy "sfjc").
update daily_learn_entries
set user_id = 'MLpnko#12'
where user_id = 'sfjc';
