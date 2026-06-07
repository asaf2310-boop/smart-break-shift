-- Safe migration if shift_unavailabilities was created without note (idempotent)
alter table shift_unavailabilities add column if not exists note text;
