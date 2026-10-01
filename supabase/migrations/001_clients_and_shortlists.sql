-- Client tracking + shortlisting.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

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
