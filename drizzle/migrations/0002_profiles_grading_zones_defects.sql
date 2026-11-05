ALTER TABLE public.crop_profiles
  ADD COLUMN IF NOT EXISTS grade_metric text NOT NULL DEFAULT 'leaves',
  ADD COLUMN IF NOT EXISTS grade_a_min_brix numeric,
  ADD COLUMN IF NOT EXISTS grade_b_min_brix numeric,
  ADD COLUMN IF NOT EXISTS defect_tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.quality_inspections ADD COLUMN IF NOT EXISTS defect_counts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.growth_measurements ADD COLUMN IF NOT EXISTS zone text;
ALTER TABLE public.harvests ADD COLUMN IF NOT EXISTS avg_brix numeric;
ALTER TABLE public.daily_checks ADD COLUMN IF NOT EXISTS nursery_batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL;
ALTER TABLE public.daily_checks ADD COLUMN IF NOT EXISTS germinated_count integer;