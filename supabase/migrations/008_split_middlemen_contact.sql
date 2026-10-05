-- ---------------------------------------------------------------
-- Middleman becomes two plainly named fields
-- ---------------------------------------------------------------
-- `middlemen_contact` was a single catch-all column that the form reused as
-- the number. It is replaced by `middlemen_contact_name` (added in 007) and
-- `middlemen_contact_number`, so neither field has to be read for what it
-- happens to contain.
alter table profiles add column if not exists middlemen_contact_number text;

-- Carry the existing values across by what they actually are. Ten digits or
-- more means it is the number; anything shorter was someone's name typed into
-- the only box there was, so it becomes the name — unless a name is already
-- recorded, which wins.
update profiles
   set middlemen_contact_number = trim(middlemen_contact)
 where middlemen_contact is not null
   and trim(middlemen_contact) <> ''
   and length(regexp_replace(middlemen_contact, '\D', '', 'g')) >= 10;

update profiles
   set middlemen_contact_name = coalesce(
         nullif(trim(middlemen_contact_name), ''),
         trim(middlemen_contact)
       )
 where middlemen_contact is not null
   and trim(middlemen_contact) <> ''
   and length(regexp_replace(middlemen_contact, '\D', '', 'g')) < 10;

-- Everything above has been moved, so the old column goes.
alter table profiles drop column if exists middlemen_contact;
