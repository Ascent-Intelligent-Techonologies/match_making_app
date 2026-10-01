-- Profile fields to match the intake form spreadsheet.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- Personal
alter table profiles add column if not exists surname text;
alter table profiles add column if not exists rasi text;
alter table profiles add column if not exists nakshatram text;
alter table profiles add column if not exists gotram text;
alter table profiles add column if not exists sub_caste text;

-- Education
alter table profiles add column if not exists school text;

-- Professional
alter table profiles add column if not exists business text;
alter table profiles add column if not exists salary text;
alter table profiles add column if not exists citizenship text;

-- Family
alter table profiles add column if not exists father_name text;
alter table profiles add column if not exists father_native_place text;
alter table profiles add column if not exists mother_name text;
alter table profiles add column if not exists mother_native_place text;
alter table profiles add column if not exists siblings_name text;
alter table profiles add column if not exists siblings_details text;
alter table profiles add column if not exists current_address text;

-- Contact
alter table profiles add column if not exists middlemen_contact text;

-- Internal classification from the "Tag" column (AM / AMP / AMO).
alter table profiles add column if not exists tag text;

create index if not exists profiles_caste_idx on profiles (lower(caste));
create index if not exists profiles_tag_idx on profiles (tag);

-- Share links can now also be limited to photos only.
alter table share_links drop constraint if exists share_links_access_level_check;
alter table share_links add constraint share_links_access_level_check
  check (access_level in ('photos_only', 'partial', 'full'));
