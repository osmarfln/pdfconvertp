-- Add is_backup flag to file_conversions
ALTER TABLE public.file_conversions
ADD COLUMN IF NOT EXISTS is_backup boolean NOT NULL DEFAULT false;

-- Index to speed up filtering backup vs active files
CREATE INDEX IF NOT EXISTS idx_file_conversions_user_backup
ON public.file_conversions (user_id, is_backup, created_at DESC);

-- Mark existing completed conversions (which already have a converted_path)
-- as having a backup so the user can see their history immediately.
-- We don't change the existing rows themselves; we only seed by inserting
-- backup copies that mirror them.
INSERT INTO public.file_conversions (
  user_id, original_name, original_format, target_format, status,
  original_path, converted_path, file_size, is_backup, created_at, updated_at
)
SELECT
  user_id, original_name, original_format, target_format, 'completed',
  original_path, converted_path, file_size, true, created_at, now()
FROM public.file_conversions
WHERE status = 'completed'
  AND converted_path IS NOT NULL
  AND is_backup = false
  AND NOT EXISTS (
    SELECT 1 FROM public.file_conversions b
    WHERE b.is_backup = true
      AND b.user_id = public.file_conversions.user_id
      AND b.converted_path = public.file_conversions.converted_path
  );