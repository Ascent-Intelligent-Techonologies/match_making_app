-- The filters last set on the admin Search page for this client, so opening
-- their search brings them back instead of starting from an empty list.
--
-- A flat JSON object of filter name to value, exactly as the filters appear in
-- the page address (see src/lib/search-filters.ts for which names are kept).
-- Null means nothing is saved, which is every existing client.
alter table clients
  add column if not exists search_filters jsonb;
