-- Self-onboarding: anyone can submit their own profile through /onboard, and it
-- stays out of Search, All Profiles, public browse, share links and the client
-- list until an admin approves it.
--
-- approval_status
--   draft     made by the public form; photos are still going up, or the
--             person walked away. Never shown to an admin, and cleaned up
--             automatically after two days.
--   pending   submitted with at least one photo, waiting for an admin.
--   approved  live. Every profile that exists today, and every profile an
--             admin adds by hand, is this - which is why it is the default.
--   rejected  reviewed and declined. Kept, so the admin can change their mind.
--
-- Additive and backwards compatible: the running app does not know these
-- columns, and every existing row defaults to 'approved', so applying this
-- before the new code is deployed changes nothing anyone can see.
alter table profiles
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('draft', 'pending', 'approved', 'rejected')),
  add column if not exists self_onboarded boolean not null default false,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

-- Only the rows waiting for attention are ever looked up by status, and nearly
-- every row is 'approved', so the index covers just the others.
create index if not exists profiles_approval_status_idx
  on profiles (approval_status)
  where approval_status <> 'approved';
