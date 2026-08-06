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
