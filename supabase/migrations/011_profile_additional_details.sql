-- Profiles: a free-text "Additional details" box, under Native place on the
-- editor's Personal tab. Admin-only: it is not on any client-visible list in
-- src/lib/types.ts, so no share link or browse page can show it.
alter table profiles add column if not exists additional_details text;
