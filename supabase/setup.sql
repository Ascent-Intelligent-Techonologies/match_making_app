-- =================================================================
-- AnuRupa Matrimony — complete database setup
-- =================================================================
-- Run this once, in the Supabase SQL editor, against a brand-new project.
-- It creates everything the app needs: tables, indexes, storage buckets and
-- the row-level-security posture.
--
-- This is the schema in its final shape, not a replay of the migration
-- history. `schema.sql` plus `migrations/` document how it got here and are
-- what an EXISTING database should be brought forward with; this file is for
-- starting again from nothing. Running both is not necessary and not useful.
--
-- Every statement is idempotent, so re-running it is safe.
--
-- Afterwards, set these environment variables for the app:
--   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (Project Settings -> API)
--   ADMIN_PASSWORD_HASH                       (bcrypt; see README)
--   SESSION_SECRET                            (long random string)
--   NEXT_PUBLIC_SITE_URL                      (no trailing slash)
-- =================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------
-- profiles — the people we match
-- -----------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Personal
  full_name text not null,
  surname text,
  gender text check (gender in ('male', 'female')),
  dob date,
  birth_time text,
  birth_place text,
  height_cm smallint,                 -- stored in cm, entered and shown in ft/in
  native_place text,

  caste text,
  sub_caste text,
  gotram text,
  nakshatram text,
  rasi text,
  star_sign text,
  religion text,
  mother_tongue text,

  -- Current location. `country` is one of India / Europe / Africa / USA /
  -- Australia; `state` is picked from a list for India and the USA and is
  -- free text anywhere else.
  country text default 'India',
  state text,
  city text,
  citizenship text,

  -- Education
  education_degree text,
  institution text,
  school text,

  -- Professional. `profession_category` is the one the job filter searches
  -- on (Doctor / Engineer / Software Engineer / Business / Others);
  -- `profession` stays free text for the detail.
  profession_category text,
  profession text,
  business text,
  company text,
  salary text,
  annual_income_inr numeric,          -- drives the finances filter; never shared

  -- Family
  father_name text,
  father_profession text,
  father_native_place text,
  mother_name text,
  mother_profession text,
  mother_native_place text,

  -- Two siblings. "potential client" marks someone we may end up
  -- matchmaking for next, which is usually an unmarried sibling.
  sibling1_name text,
  sibling1_status text,
  sibling1_details text,
  sibling1_potential_client boolean not null default false,
  sibling2_name text,
  sibling2_status text,
  sibling2_details text,
  sibling2_potential_client boolean not null default false,

  current_address text,
  family_status_notes text,

  -- Contact. The middleman's details are admin-only at every share level.
  primary_contact_name text,
  primary_contact_relation text,
  contact_phone text,
  contact_email text,
  middlemen_contact_name text,
  middlemen_contact_number text,

  -- Requirements
  partner_expectations text,
  hobbies text[],

  -- Internal. None of this is ever shown to a client.
  tags text[] not null default '{}',  -- any of AM / AMP / AMO
  anurupa_aura boolean not null default false,
  urgent boolean not null default false,
  net_worth_notes text,
  owner_private_notes text,

  -- The id this profile had in the system it was imported from; null for
  -- profiles added by hand. Its unique index is what makes re-running a bulk
  -- import update rather than duplicate.
  source_id text,

  -- Set when soft-deleted. Hidden from every query except the Deleted page,
  -- which is the only place it can be restored or removed for good.
  deleted_at timestamptz,

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

-- Supports the "has any of these tags" filter.
create index if not exists profiles_tags_idx on profiles using gin (tags);
create index if not exists profiles_deleted_at_idx on profiles (deleted_at);
create unique index if not exists profiles_source_id_key on profiles (source_id);

-- -----------------------------------------------------------------
-- profile_photos — private; the app serves signed URLs
-- -----------------------------------------------------------------
create table if not exists profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  sort_order smallint not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profile_photos_profile_id_idx on profile_photos (profile_id);

-- -----------------------------------------------------------------
-- clients — the people we are shortlisting for
-- -----------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  full_name text not null,
  -- Normalised digits (the last 10), used as the identity key so that
  -- "+91 98765 43210" and "9876543210" resolve to the same client.
  phone text not null unique,
  -- Exactly what the admin typed, for display.
  phone_display text,
  notes text,
  -- When the client last did something: opened a link or shortlisted a
  -- profile. Our own outreach deliberately does NOT touch this, or the
  -- "no response in 30+ days" list would count us as them.
  last_activity_at timestamptz,
  deleted_at timestamptz
);

create index if not exists clients_deleted_at_idx on clients (deleted_at);

-- -----------------------------------------------------------------
-- share_links — links sent to a client
-- -----------------------------------------------------------------
-- A link stays live until the admin revokes or deletes it; expires_at is a
-- retired column kept only so old rows restored from a backup still load.
create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  label text,
  -- Shown to the family at the top of the share page, above the profiles.
  notes text,
  access_level text not null default 'partial'
    check (access_level in ('photos_only', 'partial', 'full')),
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),

  -- Null means the link was sent without naming anyone, and whoever opens it
  -- is asked who they are before they can shortlist.
  client_id uuid references clients(id) on delete set null,

  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);

create index if not exists share_links_client_id_idx on share_links (client_id);

create table if not exists share_link_profiles (
  share_link_id uuid not null references share_links(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (share_link_id, profile_id)
);

-- -----------------------------------------------------------------
-- client_shortlists — profiles a client hearted
-- -----------------------------------------------------------------
-- Scoped to the client rather than the link, so a shortlist survives
-- re-sharing; share_link_id only records where it came from, and is cleared
-- rather than cascaded if that link is deleted.
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

-- -----------------------------------------------------------------
-- client_searches — what a client filtered for while browsing
-- -----------------------------------------------------------------
create table if not exists client_searches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  filters jsonb not null,
  result_count integer,
  created_at timestamptz not null default now()
);

create index if not exists client_searches_client_idx on client_searches (client_id);

-- -----------------------------------------------------------------
-- client_followups — what was said when a client called
-- -----------------------------------------------------------------
create table if not exists client_followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_followups_client_idx on client_followups (client_id);

-- -----------------------------------------------------------------
-- team_notes — one running note per consultant
-- -----------------------------------------------------------------
create table if not exists team_notes (
  slug text primary key,
  body text not null default '',
  updated_at timestamptz not null default now()
);

insert into team_notes (slug, body) values
  ('anupama', ''), ('shaurya', ''), ('shreya', '')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------
-- journey_media — photos and videos of the matches we have made
-- -----------------------------------------------------------------
create table if not exists journey_media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  storage_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  caption text
);

-- -----------------------------------------------------------------
-- app_settings — single row
-- -----------------------------------------------------------------
create table if not exists app_settings (
  id smallint primary key default 1,
  -- Retired: share links no longer expire. Kept with its default so a row
  -- inserted by an older deploy still satisfies the not-null constraint.
  default_expiry_days smallint not null default 3,
  -- Palette saved from Admin -> Settings. Null means use the app defaults.
  theme_colors jsonb,
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, default_expiry_days)
values (1, 3)
on conflict (id) do nothing;

-- -----------------------------------------------------------------
-- Storage — both buckets private
-- -----------------------------------------------------------------
-- Nothing in either bucket is reachable without a signed URL, which the app
-- mints per render with a one-hour life.
insert into storage.buckets (id, name, public) values
  ('profile-photos', 'profile-photos', false),
  ('journey-media',  'journey-media',  false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------
-- Row-level security
-- -----------------------------------------------------------------
-- RLS is enabled with NO policies anywhere, which denies the anon and
-- authenticated roles everything. All access goes through the Next.js server
-- using the service_role key, which bypasses RLS. This is deliberate: the
-- browser never talks to the database, so a leaked anon key is worthless.
alter table profiles            enable row level security;
alter table profile_photos      enable row level security;
alter table share_links         enable row level security;
alter table share_link_profiles enable row level security;
alter table app_settings        enable row level security;
alter table clients             enable row level security;
alter table client_shortlists   enable row level security;
alter table client_searches     enable row level security;
alter table client_followups    enable row level security;
alter table team_notes          enable row level security;
alter table journey_media       enable row level security;
