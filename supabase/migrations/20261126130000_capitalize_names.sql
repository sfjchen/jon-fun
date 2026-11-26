-- Player names start with a capital letter, as devices now save them, so "em" and "Em" are 1 player everywhere.
-- Boards already hold 1 row per name regardless of case, so no 2 rows can collide.
update public.game_results set name = upper(left(name, 1)) || substr(name, 2)
  where left(name, 1) <> upper(left(name, 1));
update public.push_subscriptions set name = upper(left(name, 1)) || substr(name, 2)
  where left(name, 1) <> upper(left(name, 1));
update public.sync_devices
  set label = case when label = player_name then upper(left(label, 1)) || substr(label, 2) else label end,
    player_name = upper(left(player_name, 1)) || substr(player_name, 2)
  where left(player_name, 1) <> upper(left(player_name, 1));
