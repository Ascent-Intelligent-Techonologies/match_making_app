-- Client match: pairs of a boy's and a girl's profile whose families are in
-- communication, kept on the Follow-up page.
--
-- Each row is one pair with a few notes. A profile can be in several pairs (a
-- family talking to more than one), but the same pair is only listed once.
-- Deleting a profile for good takes its pairs with it; a profile that is only
-- moved to the Deleted page keeps its pairs, which show it as deleted.
--
-- New table, nothing existing is touched: the running app does not know about
-- it, so applying this before the new code is deployed changes nothing.
create table if not exists client_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  boy_profile_id uuid not null references profiles(id) on delete cascade,
  girl_profile_id uuid not null references profiles(id) on delete cascade,
  notes text,
  check (boy_profile_id <> girl_profile_id)
);

create unique index if not exists client_matches_pair_key
  on client_matches (boy_profile_id, girl_profile_id);

-- The list is shown newest first.
create index if not exists client_matches_created_at_idx
  on client_matches (created_at desc);

-- Same backstop as every other table (see setup.sql): no policies, owner bypasses.
alter table client_matches enable row level security;
