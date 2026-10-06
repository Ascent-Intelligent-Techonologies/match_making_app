-- ---------------------------------------------------------------
-- Bulk import: where a profile came from
-- ---------------------------------------------------------------
-- The id a profile had in the system it was imported from. Profiles added by
-- hand leave it null.
--
-- The unique index is what makes re-uploading the same export safe: a second
-- run updates the rows it created the first time instead of doubling the book.
-- A plain unique index (not a partial one) is used deliberately - Postgres
-- treats nulls as distinct, so every hand-added profile still passes, and
-- ON CONFLICT can only target a complete index.
alter table profiles add column if not exists source_id text;

create unique index if not exists profiles_source_id_key on profiles (source_id);
