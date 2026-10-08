-- Share links: a note for the recipient, and no more expiry.
--
-- 1. notes — written when the link is created, shown to the family on the
--    share page and back to the admin in the links list.
-- 2. expires_at — links now stay live until the admin revokes or deletes
--    them, so the column is nullable and existing rows are cleared. The
--    column itself is kept rather than dropped, in case a date already sent
--    to a family ever needs looking up in a backup.
alter table share_links add column if not exists notes text;

alter table share_links alter column expires_at drop not null;

update share_links set expires_at = null where expires_at is not null;
