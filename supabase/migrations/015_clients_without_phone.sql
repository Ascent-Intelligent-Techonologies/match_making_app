-- Every profile is a client, with or without a phone number.
--
-- A client used to be identified by phone number alone, so a profile with no
-- number could not be one. Now the number is optional (still unique when
-- there is one), and a client made from a profile remembers which profile it
-- came from, which is also what stops a profile being added twice.
alter table clients alter column phone drop not null;

alter table clients
  add column if not exists profile_id uuid references profiles(id) on delete set null;

create unique index if not exists clients_profile_id_key
  on clients (profile_id) where profile_id is not null;

-- 1. The clients made from profiles by migration 014 (all created on
--    2026-10-28) get linked to their oldest profile with that number.
update clients c
   set profile_id = p.id
  from (
    select distinct on (right(regexp_replace(contact_phone, '\D', '', 'g'), 10))
           id,
           right(regexp_replace(contact_phone, '\D', '', 'g'), 10) as digits
      from profiles
     where deleted_at is null
       and coalesce(trim(full_name), '') <> ''
       and length(regexp_replace(coalesce(contact_phone, ''), '\D', '', 'g')) >= 10
     order by right(regexp_replace(contact_phone, '\D', '', 'g'), 10), created_at
  ) p
 where c.phone = p.digits
   and c.profile_id is null
   and c.created_at >= timestamptz '2026-10-28 00:00:00+00';

-- 2. Every other profile gets a client of its own, dated like the profile.
--    The number goes on the client when it is usable and nobody else holds it;
--    otherwise only the number as typed is kept, for reference.
insert into clients (full_name, phone, phone_display, profile_id, created_at)
select
  name,
  case when digits_ok and n = 1 and not taken then digits end,
  case when digits_ok then typed end,
  id,
  created_at
from (
  select
    p.id,
    p.created_at,
    concat_ws(' ', nullif(trim(p.full_name), ''), nullif(trim(p.surname), '')) as name,
    trim(p.contact_phone)                                                     as typed,
    right(regexp_replace(coalesce(p.contact_phone, ''), '\D', '', 'g'), 10)   as digits,
    length(regexp_replace(coalesce(p.contact_phone, ''), '\D', '', 'g')) >= 10 as digits_ok,
    row_number() over (
      partition by right(regexp_replace(coalesce(p.contact_phone, ''), '\D', '', 'g'), 10)
      order by p.created_at
    ) as n,
    exists (
      select 1 from clients c
       where c.phone = right(regexp_replace(coalesce(p.contact_phone, ''), '\D', '', 'g'), 10)
    ) as taken
  from profiles p
  where p.deleted_at is null
    and coalesce(trim(p.full_name), '') <> ''
    and not exists (select 1 from clients c where c.profile_id = p.id)
) as todo;
