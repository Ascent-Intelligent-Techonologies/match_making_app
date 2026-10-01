-- Track what browsing clients search for.
-- Idempotent: safe to run more than once. Run in the Supabase SQL editor.

create table if not exists client_searches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  -- The filter set they applied, as given in the URL.
  filters jsonb not null default '{}'::jsonb,
  result_count integer,
  created_at timestamptz not null default now()
);

create index if not exists client_searches_client_idx on client_searches (client_id, created_at desc);

alter table client_searches enable row level security;
