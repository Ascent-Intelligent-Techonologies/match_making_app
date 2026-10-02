-- Native place on the profile, and a follow-up log per client.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

-- "Native" on the intake sheet's share tab is the family's native place,
-- which is distinct from the city they currently live in.
alter table profiles add column if not exists native_place text;

-- A dated note each time we speak to a client, so a call can be logged and
-- surfaced on the dashboard.
create table if not exists client_followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists client_followups_client_idx
  on client_followups (client_id, created_at desc);
create index if not exists client_followups_created_idx
  on client_followups (created_at desc);

alter table client_followups enable row level security;
