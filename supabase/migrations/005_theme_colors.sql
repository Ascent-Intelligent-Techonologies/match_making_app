-- Theme colours, editable from Admin → Settings → Appearance.
--
-- Stored as one jsonb blob rather than six columns: the palette is read and
-- written as a whole, and adding a slot later needs no further migration.
-- NULL means "use the defaults compiled into the app".
alter table app_settings
  add column if not exists theme_colors jsonb;
