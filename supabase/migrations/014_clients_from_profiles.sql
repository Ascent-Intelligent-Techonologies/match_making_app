-- One-time: every profile that has a name and a usable contact number becomes
-- a client, the same as profiles created from now on (see
-- ensureClientForProfile in src/lib/data/clients.ts).
--
-- The client is named like the profile ("name surname") and keyed on the
-- number the way the app keys it: digits only, last ten. Profiles sharing a
-- number (siblings, a re-entered profile) make one client, named after the
-- oldest of them. A number that is already a client, deleted or not, is left
-- exactly as it is, so this renames nobody and brings nobody back.
--
-- Run once. Running it again adds nothing unless a client has since been
-- permanently deleted, in which case it would be added back.
insert into clients (full_name, phone, phone_display)
select distinct on (digits)
  name, digits, phone_display
from (
  select
    concat_ws(' ', nullif(trim(full_name), ''), nullif(trim(surname), '')) as name,
    right(regexp_replace(contact_phone, '\D', '', 'g'), 10)                as digits,
    trim(contact_phone)                                                     as phone_display,
    created_at
  from profiles
  where deleted_at is null
    and coalesce(trim(full_name), '') <> ''
    and length(regexp_replace(coalesce(contact_phone, ''), '\D', '', 'g')) >= 10
) as candidates
order by digits, created_at
on conflict (phone) do nothing;
