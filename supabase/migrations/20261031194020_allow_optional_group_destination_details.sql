-- The form treats meeting details as optional; keep only the mode-specific destination column exclusive.
ALTER TABLE public.study_groups DROP CONSTRAINT group_mode_destination_check;
ALTER TABLE public.study_groups
  ADD CONSTRAINT group_mode_destination_check
  CHECK (
    (mode = 'online'::public.group_mode AND offline_area_label IS NULL)
    OR
    (mode = 'offline'::public.group_mode AND online_url IS NULL)
  );
