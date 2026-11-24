-- The name a device played as before an admin renamed it, so the device adopts the new name on its next visit
-- instead of filing under the old one again. Cleared once the device sends the new name.
alter table sync_devices add column if not exists player_was text;
