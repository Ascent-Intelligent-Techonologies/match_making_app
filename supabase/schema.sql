-- Aura matchmaking app schema
-- Run this in the Supabase SQL editor for your project.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- basic
  full_name text not null,
  gender text check (gender in ('male', 'female')),
  dob date,
  height_cm smallint,
  city text,
  state text,
  country text default 'India',
  marital_status text check (
    marital_status in ('never_married', 'divorced', 'widowed', 'awaiting_divorce')
  ),
  religion text,
  caste text,
  mother_tongue text,

  -- education & career
  education_degree text,
  institution text,
  profession text,
  company text,
  annual_income_inr numeric,

  -- family background
  father_profession text,
  mother_profession text,
  siblings_count smallint,
  family_status_notes text,

  -- horoscope / astrology
  birth_time text,
  birth_place text,
  star_sign text,
  manglik text check (manglik in ('yes', 'no', 'anshik', 'unknown')),
  horoscope_notes text,

  -- lifestyle & preferences
  hobbies text[],
  diet text check (diet in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain')),
  partner_expectations text,

  -- owner-only sensitive data
  net_worth_notes text,
  contact_phone text,
  contact_email text,
  owner_private_notes text,

  is_active boolean not null default true
);

create index if not exists profiles_search_idx on profiles
  using gin (
    to_tsvector(
      'simple',
      coalesce(full_name, '') || ' ' || coalesce(city, '') || ' ' ||
      coalesce(profession, '') || ' ' || coalesce(religion, '') || ' ' ||
      coalesce(caste, '')
    )
  );

create table if not exists profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profile_photos_profile_id_idx on profile_photos(profile_id);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  label text,
  access_level text not null check (access_level in ('partial', 'full')) default 'partial',
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists share_link_profiles (
  share_link_id uuid not null references share_links(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (share_link_id, profile_id)
);

create table if not exists app_settings (
  id smallint primary key default 1,
  default_expiry_days smallint not null default 3,
  -- Theme palette set from Admin -> Settings. NULL = use the app defaults.
  -- (see migrations/005_theme_colors.sql)
  theme_colors jsonb,
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, default_expiry_days)
values (1, 3)
on conflict (id) do nothing;

-- Storage bucket for profile photos (private; app issues signed URLs)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

-- Lock everything down at the RLS level. All access goes through the
-- Next.js server using the service_role key, which bypasses RLS entirely.
-- The anon/public key (used only for the yet-unused browser client) gets no access.
alter table profiles enable row level security;
alter table profile_photos enable row level security;
alter table share_links enable row level security;
alter table share_link_profiles enable row level security;
alter table app_settings enable row level security;

-- (No policies are created, which means anon/authenticated roles have zero access by default.)

-- ---------------------------------------------------------------
-- Client tracking + shortlisting (see migrations/001_clients_and_shortlists.sql)
-- ---------------------------------------------------------------
-- A client is a person we are shortlisting for, identified by phone number.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  full_name text not null,
  -- Normalised digits (last 10), used as the identity key so that
  -- "+91 98765 43210" and "9876543210" resolve to the same client.
  phone text not null,
  -- Exactly what the admin typed, for display.
  phone_display text,
  notes text,
  -- Most recent time this client viewed a share link or shortlisted a profile.
  last_activity_at timestamptz,

  constraint clients_phone_unique unique (phone)
);

create index if not exists clients_name_idx on clients (lower(full_name));
create index if not exists clients_last_activity_idx on clients (last_activity_at);

-- Tie each share link to the client it was shared with, and track opens.
alter table share_links add column if not exists client_id uuid references clients(id) on delete set null;
alter table share_links add column if not exists first_viewed_at timestamptz;
alter table share_links add column if not exists last_viewed_at timestamptz;
alter table share_links add column if not exists view_count integer not null default 0;

create index if not exists share_links_client_id_idx on share_links (client_id);

-- Profiles a client has hearted. Scoped to the client (not the link) so a
-- shortlist survives across re-shares; share_link_id records where it came from.
create table if not exists client_shortlists (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  share_link_id uuid references share_links(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint client_shortlists_unique unique (client_id, profile_id)
);

create index if not exists client_shortlists_client_idx on client_shortlists (client_id);
create index if not exists client_shortlists_profile_idx on client_shortlists (profile_id);

-- Same posture as the rest of the schema: no policies, so only the
-- service_role key (which bypasses RLS) can touch these.
alter table clients enable row level security;
alter table client_shortlists enable row level security;

-- ---------------------------------------------------------------
-- Redesigned intake form, follow-up notes, journey media, soft delete
-- (see migrations/006_profile_layout_followups_and_soft_delete.sql)
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

-- ---------------------------------------------------------------
-- Aura flag, multi-select tag, split contact fields
-- (see migrations/007_aura_multi_tag_and_contact_split.sql)
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
