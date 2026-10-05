-- ---------------------------------------------------------------
-- Anurupa Aura
-- ---------------------------------------------------------------
-- A second internal flag alongside the tag, ticked on the Internal tab and
-- filterable from All Profiles and search.
alter table profiles add column if not exists anurupa_aura boolean not null default false;

-- ---------------------------------------------------------------
-- Anurupa Tag becomes multi-select
-- ---------------------------------------------------------------
-- A profile can carry more than one of AM / AMP / AMO. The old single-value
-- `tag` column is left in place untouched as a historical record; everything
-- reads and writes `tags` from here on.
alter table profiles add column if not exists tags text[] not null default '{}';

-- Carry each existing single tag over, so nothing has to be re-entered.
update profiles
   set tags = array[tag]
 where tag is not null
   and tag <> ''
   and (tags is null or tags = '{}');

-- Overlap queries ("has any of these tags") use this.
create index if not exists profiles_tags_idx on profiles using gin (tags);

-- ---------------------------------------------------------------
-- Contact details, split out per the intake form
-- ---------------------------------------------------------------
-- The existing columns keep their meaning and their data: `contact_phone` is
-- the primary contact's number and `middlemen_contact` the middleman's. These
-- add the names and the relationship that sat beside them on paper.
alter table profiles add column if not exists primary_contact_name text;
alter table profiles add column if not exists primary_contact_relation text;
alter table profiles add column if not exists middlemen_contact_name text;
