-- ---------------------------------------------------------------
-- Profile fields added with the redesigned intake form
-- ---------------------------------------------------------------
-- The job category behind the search filter (Doctor / Engineer / ...).
alter table profiles add column if not exists profession_category text;

-- "Urgent" marks a profile to be prioritised; it is an internal flag.
alter table profiles add column if not exists urgent boolean not null default false;

-- Two siblings, each with a marital status and a "potential client" box.
-- An unmarried sibling is someone we may end up matchmaking for next.
alter table profiles add column if not exists sibling1_name text;
alter table profiles add column if not exists sibling1_status text;
alter table profiles add column if not exists sibling1_details text;
alter table profiles add column if not exists sibling1_potential_client boolean not null default false;
alter table profiles add column if not exists sibling2_name text;
alter table profiles add column if not exists sibling2_status text;
alter table profiles add column if not exists sibling2_details text;
alter table profiles add column if not exists sibling2_potential_client boolean not null default false;

-- ---------------------------------------------------------------
-- Soft delete
-- ---------------------------------------------------------------
-- A soft-deleted row stays in the table and is filtered out of every list;
-- the Deleted page in the dashboard is the only place it still shows, so it
-- can be restored or removed for good.
alter table profiles add column if not exists deleted_at timestamptz;
alter table clients  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on profiles (deleted_at);
create index if not exists clients_deleted_at_idx on clients (deleted_at);

-- ---------------------------------------------------------------
-- Follow-up notes, one running note per consultant
-- ---------------------------------------------------------------
create table if not exists team_notes (
  slug text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table team_notes enable row level security;

insert into team_notes (slug, body) values
  ('anupama', ''), ('shaurya', ''), ('shreya', '')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- Journey: shared photos and videos
-- ---------------------------------------------------------------
create table if not exists journey_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  caption text
);

alter table journey_media enable row level security;

insert into storage.buckets (id, name, public)
values ('journey-media', 'journey-media', false)
on conflict (id) do nothing;
