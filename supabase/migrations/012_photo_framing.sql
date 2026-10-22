-- Profile photos: how each one is framed in the cards.
--
-- focus_x / focus_y — the point of the photo that must stay in view, as a
--   percentage across and down (0 = left/top, 100 = right/bottom).
-- zoom — 1 shows the whole photo as far as the frame allows; larger crops in.
--
-- All three are null until someone frames the photo, and null means
-- "automatic" (see src/lib/framing.ts), so every photo already on file keeps
-- working and picks up the automatic framing without a data change.
alter table profile_photos
  add column if not exists focus_x real check (focus_x between 0 and 100),
  add column if not exists focus_y real check (focus_y between 0 and 100),
  add column if not exists zoom    real check (zoom between 1 and 4);
